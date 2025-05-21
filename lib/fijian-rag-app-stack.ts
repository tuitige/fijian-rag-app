// === CDK: fijian-rag-app-stack.ts ===

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class FijianRagAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const agentNames = [
      'scraper',
      'translator',
      'verifier',
      'chunker',
      'embedder',
      'trainingDataGenerator'
    ];

    // === S3 Buckets ===
    const contentBucket = new s3.Bucket(this, 'ContentBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const trainingDataBucket = new s3.Bucket(this, 'TrainingDataBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // === DynamoDB Table ===
    const translationsTable = new dynamodb.Table(this, 'TranslationsTable', {
      partitionKey: { name: 'dataType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'dataKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // === Lambdas ===
    const lambdas: Record<string, lambdaNodejs.NodejsFunction> = {};

    for (const name of agentNames) {
      lambdas[name] = new lambdaNodejs.NodejsFunction(this, `${name}Lambda`, {
        entry: path.join(__dirname, `../lambda/${name}/index.ts`),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 1024,
        timeout: cdk.Duration.seconds(60),
        bundling: {
          nodeModules: ['axios', 'cheerio', '@aws-sdk/client-secrets-manager', '@aws-sdk/client-dynamodb']
        },
        environment: {
          TABLE_NAME: translationsTable.tableName,
          CONTENT_BUCKET: contentBucket.bucketName,
          TRAINING_BUCKET: trainingDataBucket.bucketName,
        }
      });

      translationsTable.grantReadWriteData(lambdas[name]);
      contentBucket.grantReadWrite(lambdas[name]);
      trainingDataBucket.grantReadWrite(lambdas[name]);
    }

    // === Unified API Gateway ===
    const unifiedApi = new apigateway.RestApi(this, 'UnifiedAgentApi', {
      restApiName: 'AgentApi',
      deployOptions: { stageName: 'prod' },
    });

    // === API Key ===
    const manualApiKeyValue = 'my-agent-key-123-xyz789'; // 24 characters

    const apiKey = unifiedApi.addApiKey('UnifiedAgentApiKey', {
      value: manualApiKeyValue
    });

    const usagePlan = unifiedApi.addUsagePlan('UnifiedAgentUsagePlan', {
      name: 'AgentUsagePlan',
      apiStages: [{ api: unifiedApi, stage: unifiedApi.deploymentStage }],
    });
    usagePlan.addApiKey(apiKey);

    // === Store API Key in Secrets Manager ===
    const apiKeySecret = new secretsmanager.Secret(this, 'AgentApiKeySecret', {
      secretName: 'AgentApiKey',
      secretStringValue: cdk.SecretValue.unsafePlainText(manualApiKeyValue),
    });

    // === Attach unified API to each agent ===
    for (const name of agentNames) {
      const fn = lambdas[name];
      const resource = unifiedApi.root.addResource(name);
      resource.addMethod('POST', new apigateway.LambdaIntegration(fn), {
        apiKeyRequired: true,
      });

      // Grant Lambda permission to read secret
      apiKeySecret.grantRead(fn);
    }

    if (lambdas['translator']) {
      lambdas['translator'].addToRolePolicy(new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: ['arn:aws:bedrock:us-west-2::foundation-model/*'],
      }));
    }


    // === Orchestrator Lambda ===
    const orchestratorLambda = new lambdaNodejs.NodejsFunction(this, 'OrchestratorLambda', {
      entry: path.join(__dirname, '../lambda/orchestrator/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
      bundling: {
        nodeModules: [
          'axios',
          'uuid',
          '@aws-sdk/client-lambda',
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-secrets-manager'
        ]
      },
      environment: {
        TABLE_NAME: translationsTable.tableName,
        CONTENT_BUCKET: contentBucket.bucketName,
        TRAINING_BUCKET: trainingDataBucket.bucketName,
        API_KEY_SECRET_NAME: apiKeySecret.secretName,
        UNIFIED_API_BASE_URL: `https://${unifiedApi.restApiId}.execute-api.${cdk.Stack.of(this).region}.amazonaws.com/prod`
      }
    });

    // Grant orchestrator access to invoke other Lambdas via API Gateway
    apiKeySecret.grantRead(orchestratorLambda);
    translationsTable.grantReadWriteData(orchestratorLambda);
    contentBucket.grantReadWrite(orchestratorLambda);
    trainingDataBucket.grantReadWrite(orchestratorLambda);

    // Add orchestrator endpoint under unified API
    const orchestratorResource = unifiedApi.root.addResource('orchestrator');
    orchestratorResource.addMethod('POST', new apigateway.LambdaIntegration(orchestratorLambda), {
      apiKeyRequired: true,
    });



  }
}
