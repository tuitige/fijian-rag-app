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
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as path from 'path';

export class FijianRagAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // === S3 Buckets ===
    const contentBucket = new s3.Bucket(this, 'ContentBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const trainingDataBucket = new s3.Bucket(this, 'TrainingDataBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // === DynamoDB Tables ===
    const translationsReviewTable = new dynamodb.Table(this, 'TranslationsReviewTable', {
      partitionKey: { name: 'dataType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'dataKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    translationsReviewTable.addGlobalSecondaryIndex({
      indexName: 'GSI_UnverifiedKey',
      partitionKey: { name: 'dedupKey', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'dataType', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    translationsReviewTable.addGlobalSecondaryIndex({
      indexName: 'GSI_VerifiedIndex',
      partitionKey: { name: 'verified', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'dataType', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });


    const verifiedTranslationsTable = new dynamodb.Table(this, 'VerifiedTranslationsTable', {
      partitionKey: { name: 'fijian', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'english', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const verifiedVocabTable = new dynamodb.Table(this, 'VerifiedVocabTable', {
      partitionKey: { name: 'word', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'meaning', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const verifiedParagraphsTable = new dynamodb.Table(this, 'VerifiedParagraphsTable', {
      partitionKey: { name: 'articleId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'paragraphId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });    

    // === OpenSearch Serverless Collection ===
    const osDomain = new opensearch.Domain(this, 'FijianRagCollection', {
      version: opensearch.EngineVersion.OPENSEARCH_2_11,
      domainName: 'fijian-rag-app',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      capacity: {
        dataNodeInstanceType: 't3.small.search',
        dataNodes: 1,
        multiAzWithStandbyEnabled: false
      },
      zoneAwareness: {
        enabled: false
      },
      enforceHttps: true,
      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true,
      },
      fineGrainedAccessControl: {
        masterUserName: 'admin',
        masterUserPassword: cdk.SecretValue.unsafePlainText('MitiBeka!2#4!')
      }
    });




    // === Lambda: data-ingestion-pipeline ===
    const ingestLambda = new lambdaNodejs.NodejsFunction(this, 'DataIngestionLambda', {
      entry: path.join(__dirname, '../lambda/data-ingestion-pipeline/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(300),
      bundling: {
        nodeModules: ['axios', '@aws-sdk/client-bedrock-runtime', '@aws-sdk/client-dynamodb']
      },
      environment: {
        TRANSLATIONS_REVIEW_TABLE_NAME: translationsReviewTable.tableName,
        VERIFIED_PARAGRAPHS_TABLE: verifiedParagraphsTable.tableName,
        VERIFIED_TRANSLATIONS_TABLE: verifiedTranslationsTable.tableName,
        VERIFIED_VOCAB_TABLE: verifiedVocabTable.tableName,
        CONTENT_BUCKET: contentBucket.bucketName,
        TRAINING_BUCKET: trainingDataBucket.bucketName
      },
    });

    translationsReviewTable.grantReadWriteData(ingestLambda);
    verifiedTranslationsTable.grantReadWriteData(ingestLambda);
    verifiedVocabTable.grantReadWriteData(ingestLambda);
    contentBucket.grantReadWrite(ingestLambda);
    trainingDataBucket.grantReadWrite(ingestLambda);
    verifiedParagraphsTable.grantReadWriteData(ingestLambda);

    ingestLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:*::foundation-model/*']
    }));

    // === Lambda: verify-handler ===
    const verifyHandler = new lambdaNodejs.NodejsFunction(this, 'VerifyHandlerLambda', {
      entry: path.join(__dirname, '../lambda/verification-review/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(300),
      bundling: {
        nodeModules: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/util-dynamodb',
          '@aws-sdk/client-opensearch',
          '@aws-sdk/credential-provider-node',
          '@smithy/protocol-http',
          '@smithy/node-http-handler',
          '@smithy/signature-v4',
          '@smithy/util-utf8',
          '@aws-crypto/sha256-js',          
        ]
      },
      environment: {
        TRANSLATIONS_REVIEW_TABLE_NAME: translationsReviewTable.tableName,
        VERIFIED_PARAGRAPHS_TABLE: verifiedParagraphsTable.tableName,
        VERIFIED_TRANSLATIONS_TABLE: verifiedTranslationsTable.tableName,
        VERIFIED_VOCAB_TABLE: verifiedVocabTable.tableName,
        OS_ENDPOINT: osDomain.domainEndpoint,
        TRAINING_BUCKET: trainingDataBucket.bucketName,
      },
    });

    // Permissions
    translationsReviewTable.grantReadWriteData(verifyHandler);
    verifiedTranslationsTable.grantReadWriteData(verifyHandler);
    verifiedVocabTable.grantReadWriteData(verifyHandler);
    verifiedParagraphsTable.grantReadWriteData(verifyHandler);
    trainingDataBucket.grantReadWrite(verifyHandler);
    //osDomain.grantReadWrite(verifyHandler);

    verifyHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'es:ESHttpPost',
        'es:ESHttpPut',
        'es:ESHttpDelete'
      ],
      resources: [`arn:aws:es:${this.region}:${this.account}:domain/${osDomain.domainName}/*`]
    }));

    verifyHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:*::foundation-model/*']
    }));    

    // === API Gateway ===
    const unifiedApi = new apigateway.RestApi(this, 'fijian-ai-api', {
      restApiName: 'Fijian AI API',
      description: 'API for Fijian AI application',
      deployOptions: { stageName: 'prod' },
    });

    // === Securely Generate API Key (no hardcoded string) ===
    const apiKey = unifiedApi.addApiKey('UnifiedAgentApiKey', {
      description: 'API Key for accessing /verify and /ingest endpoints'
    });

    const usagePlan = unifiedApi.addUsagePlan('UnifiedAgentUsagePlan', {
      name: 'AgentUsagePlan',
      apiStages: [{ api: unifiedApi, stage: unifiedApi.deploymentStage }],
    });
    usagePlan.addApiKey(apiKey);

    // === Claude Secret for SDK ===
    const anthropicApiKeySecret = new secretsmanager.Secret(this, 'AnthropicApiKey', {
      secretName: 'AnthropicApiKey',
      description: 'API key for direct Claude access via SDK',
    });

    anthropicApiKeySecret.grantRead(ingestLambda);
    ingestLambda.addEnvironment('ANTHROPIC_SECRET_ARN', anthropicApiKeySecret.secretArn);

    // === /ingest endpoint ===
    const ingestResource = unifiedApi.root.addResource('ingest');
    ingestResource.addMethod('POST', new apigateway.LambdaIntegration(ingestLambda), {
      apiKeyRequired: true,
    });

    // === /verify-items endpoint ===
    const verifyResource = unifiedApi.root.addResource('verify-items');
    verifyResource.addMethod('GET', new apigateway.LambdaIntegration(verifyHandler), {
      apiKeyRequired: true,
    });

    // === /verify-item endpoint ===
    const submitVerifyResource = unifiedApi.root.addResource('verify-item');
    submitVerifyResource.addMethod('POST', new apigateway.LambdaIntegration(verifyHandler), {
      apiKeyRequired: true,
    });

  }
}
