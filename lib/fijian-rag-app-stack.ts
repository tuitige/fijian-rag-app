// lib/fijian-rag-app-stack.ts
import * as path from 'path';
import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejsLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export class FijianRagStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1. S3 Buckets
    const contentBucket = new s3.Bucket(this, 'fijian-rag-app-content', {
      bucketName: 'fijian-rag-app-content',
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // 2. DynamoDB Tables
    const translationsTable = new dynamodb.Table(this, 'FijianTranslationsTable', {
      tableName: 'TranslationsTable',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Add GSI for source language queries
    translationsTable.addGlobalSecondaryIndex({
      indexName: 'SourceLanguageIndex',
      partitionKey: { name: 'sourceLanguage', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // DDB learningModulesTable
    const learningModulesTable = new dynamodb.Table(this, 'LearningModules', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Add GSIs for querying
    learningModulesTable.addGlobalSecondaryIndex({
      indexName: 'byLearningModule',
      partitionKey: { name: 'learningModuleTitle', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'pageNumber', type: dynamodb.AttributeType.NUMBER }
    });

    // 3. Cognito Setup
    const userPool = new cognito.UserPool(this, 'FijianAppUserPool', {
      userPoolName: 'fijian-app-user-pool',
      selfSignUpEnabled: false,
      signInAliases: {
        email: true
      }
    });

    const userPoolClient = userPool.addClient('FijianAppClient', {
      generateSecret: false,
      oAuth: {
        flows: {
          implicitCodeGrant: true
        },
        scopes: [cognito.OAuthScope.OPENID],
        callbackUrls: ['http://localhost:3000']
      }
    });

    // 4. IAM Role with all necessary permissions
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    // Grant DynamoDB permissions including GSI access
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:BatchGetItem',
        'dynamodb:BatchWriteItem'
      ],
      resources: [
        translationsTable.tableArn,
        `${translationsTable.tableArn}/index/*`
      ]
    }));

    // Grant Bedrock permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: [
        'arn:aws:bedrock:us-west-2::foundation-model/amazon.titan-embed-text-v1',
        'arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-v2',
        'arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0'
      ]
    }));

    // 5. Lambda Functions
    const fijianLambda = new nodejsLambda.NodejsFunction(this, 'FijianHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../lambda/fijian/src/handler.ts'),
      handler: 'handler',
      role: lambdaRole,
      timeout: Duration.minutes(5),
      environment: {
        TABLE_NAME: translationsTable.tableName,
        LEARNING_TABLE_NAME: learningModulesTable.tableName
      },
      bundling: {
        minify: true,
        sourceMap: true,
      }
    });

    learningModulesTable.grantReadWriteData(fijianLambda);

    const textractProcessor = new nodejsLambda.NodejsFunction(this, 'TextractProcessor', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../lambda/textract-processor/src/handler.ts'),
      handler: 'handler',
      role: lambdaRole,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      environment: {
        BUCKET_NAME: contentBucket.bucketName,
        TABLE_NAME: learningModulesTable.tableName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
      }
    });

    learningModulesTable.grantWriteData(textractProcessor);

    // Add Textract permissions
    textractProcessor.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'textract:StartDocumentTextDetection',
        'textract:GetDocumentTextDetection',
        'textract:StartDocumentAnalysis',
        'textract:GetDocumentAnalysis'
      ],
      resources: ['*']
    }));

    // Grant S3 permissions
    contentBucket.grantRead(textractProcessor);
    contentBucket.grantWrite(textractProcessor);

    // Add S3 trigger
    contentBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(textractProcessor),
      { prefix: 'modules/', suffix: '.jpg' }
    );

    // 6. API Gateway
    const api = new apigateway.RestApi(this, 'FijianRagApi', {
      restApiName: 'FijianLanguageService',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS', 'GET'],
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token'
        ],
        allowCredentials: true,
      }
    });
    
    const postOnlyPaths: string[] = ['translate', 'verify', 'similar'];

    // Add POST-only paths
    postOnlyPaths.forEach(pathPart => {
      api.root.addResource(pathPart).addMethod('POST', 
        new apigateway.LambdaIntegration(fijianLambda)
      );
    });
    
    // Add learn endpoint with both GET and POST
    const learnResource = api.root.addResource('learn');
    learnResource.addMethod('GET', new apigateway.LambdaIntegration(fijianLambda));
    learnResource.addMethod('POST', new apigateway.LambdaIntegration(fijianLambda));
    
    // textract aggregator lambda/api
    const textractAggregatorFn = new NodejsFunction(this, "TextractAggregatorLambda", {
      entry: path.join(__dirname, "../lambda/textract-processor/src/textract-aggregator.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        BUCKET_NAME: contentBucket.bucketName,
      },
    });
       
    contentBucket.grantReadWrite(textractAggregatorFn); // Let Lambda read OCR and write results
    
    const textractApi = new apigateway.LambdaRestApi(this, "TextractAggregatorAPI", {
      handler: textractAggregatorFn,
      proxy: false,
    });
    
    const aggregate = textractApi.root.addResource("aggregate");
    aggregate.addMethod("GET"); // call: GET /aggregate?prefix=folder-path

    // Learning Module generator Lambda genAI
    const moduleGeneratorFn = new NodejsFunction(this, "ClaudeModuleGeneratorLambda", {
      entry: path.join(__dirname, "../lambda/claude-module-generator.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        BUCKET_NAME: contentBucket.bucketName,
      },
    });
    
    contentBucket.grantReadWrite(moduleGeneratorFn);
    
    // Trigger ONLY when chapterText.json is added
    contentBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(moduleGeneratorFn),
      { prefix: "aggregated/", suffix: "chapterText.json" }
    );     

    // 7. Outputs
    new CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL'
    });

    new CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID'
    });

    new CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID'
    });
  }
}