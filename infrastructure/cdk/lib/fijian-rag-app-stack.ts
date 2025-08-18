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

import * as cognito from 'aws-cdk-lib/aws-cognito';
import { CognitoUserPoolsAuthorizer } from 'aws-cdk-lib/aws-apigateway';

import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';

function addCorsOptions(resource: apigateway.IResource) {
  resource.addMethod(
    'OPTIONS',
    new apigateway.MockIntegration({
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key'",
            'method.response.header.Access-Control-Allow-Origin': "'https://fijian-ai.org'",
            'method.response.header.Access-Control-Allow-Methods': "'GET,POST,OPTIONS'",
          },
        },
      ],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: { 'application/json': '{"statusCode": 200}' },
    }),
    {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Methods': true,
          },
        },
      ],
    }
  );
}


export class FijianRagAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = cognito.UserPool.fromUserPoolId(this, 'ExistingUserPool', 'us-west-2_shE3zxrwp');
    const authorizer = new CognitoUserPoolsAuthorizer(this, 'FijianCognitoAuthorizer', {
      cognitoUserPools: [userPool]
    });

    // === Claude Secret for SDK ===
    const anthropicApiKeySecret = new secretsmanager.Secret(this, 'AnthropicApiKey', {
      secretName: 'AnthropicApiKey',
      description: 'API key for direct Claude access via SDK',
    });

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

    // === NEW: Dictionary Tables as specified in issue ===
    const dictionaryTable = new dynamodb.Table(this, 'DictionaryTable', {
      partitionKey: { name: 'word', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'language', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userProgressTable = new dynamodb.Table(this, 'UserProgressTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Tracks translation quality metrics used for model selection
    const translationQualityTable = new dynamodb.Table(this, 'TranslationQualityTable', {
      partitionKey: { name: 'metric', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Queue of articles for the ingestion-agent to process
    const articleQueueTable = new dynamodb.Table(this, 'ArticleQueueTable', {
      partitionKey: { name: 'url', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // === NEW: DynamoDB Tables for Learning Modules ===
    const learningModulesTable = new dynamodb.Table(this, 'LearningModulesTable', {
      partitionKey: { name: 'moduleId', type: dynamodb.AttributeType.STRING }, // e.g., "ch02.5"
      sortKey: { name: 'contentType', type: dynamodb.AttributeType.STRING }, // e.g., "metadata", "vocabulary", "grammar"
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    learningModulesTable.addGlobalSecondaryIndex({
      indexName: 'GSI_ChapterContent',
      partitionKey: { name: 'chapter', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'lessonNumber', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const moduleVocabularyTable = new dynamodb.Table(this, 'ModuleVocabularyTable', {
      partitionKey: { name: 'vocabularyId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'moduleId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    moduleVocabularyTable.addGlobalSecondaryIndex({
      indexName: 'GSI_ModuleVocab',
      partitionKey: { name: 'moduleId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'fijian', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    moduleVocabularyTable.addGlobalSecondaryIndex({
      indexName: 'GSI_VocabByType',
      partitionKey: { name: 'type', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'moduleId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
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




    // === REMOVED: Legacy data-ingestion-pipeline lambda ===
    // This legacy data ingestion system was removed during clean slate migration

    // === REMOVED: Legacy ingestion-agent lambda ===
    // This ingestion coordination system was removed during clean slate migration

    // === REMOVED: Legacy verification-review lambda ===
    // This human verification system was removed during clean slate migration    

    // === NEW: Lambda for Processing Learning Modules ===
    const processLearningModuleLambda = new lambdaNodejs.NodejsFunction(this, 'ProcessLearningModuleLambda', {
      entry: path.join(__dirname, '../../../backend/lambdas/dictionary/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 2048, // More memory for processing multiple images
      timeout: cdk.Duration.seconds(900), // 15 minutes for processing full chapters
      bundling: {
        nodeModules: [
          '@anthropic-ai/sdk',
          '@aws-sdk/client-s3',
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/util-dynamodb',
          '@aws-sdk/client-opensearch',
          '@aws-sdk/credential-provider-node',
          '@smithy/protocol-http',
          '@smithy/node-http-handler',
          '@smithy/signature-v4',
          '@aws-crypto/sha256-js',
          'uuid'
        ]
      },
      environment: {
        CONTENT_BUCKET: contentBucket.bucketName,
        LEARNING_MODULES_TABLE: learningModulesTable.tableName,
        MODULE_VOCABULARY_TABLE: moduleVocabularyTable.tableName,
        VERIFIED_TRANSLATIONS_TABLE: verifiedTranslationsTable.tableName,
        VERIFIED_VOCAB_TABLE: verifiedVocabTable.tableName,
        DICTIONARY_TABLE: dictionaryTable.tableName,
        USER_PROGRESS_TABLE: userProgressTable.tableName,
        OS_ENDPOINT: osDomain.domainEndpoint,
        OS_REGION: this.region,
        ANTHROPIC_SECRET_ARN: anthropicApiKeySecret.secretArn,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // === REMOVED: Legacy load-learning-module-json lambda ===
    // This JSON loading utility was removed during clean slate migration

    // === REMOVED: Legacy merge-pages lambda ===
    // This experimental page merging functionality was removed during clean slate migration

    // === NEW: Lambda for chat and learn endpoints ===
    const fijianApiLambda = new lambdaNodejs.NodejsFunction(this, 'FijianApiLambda', {
      entry: path.join(__dirname, '../../../backend/lambdas/chat/src/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      bundling: {
        nodeModules: ['@aws-sdk/client-bedrock-runtime', '@aws-sdk/client-dynamodb', '@aws-sdk/util-dynamodb']
      },
      environment: {
        USER_PROGRESS_TABLE: userProgressTable.tableName,
      },
    });

    // === NEW: Lambda for RAG queries and dictionary operations ===
    const ragLambda = new lambdaNodejs.NodejsFunction(this, 'RagLambda', {
      entry: path.join(__dirname, '../../../backend/lambdas/rag/src/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(120),
      bundling: {
        nodeModules: [
          '@aws-sdk/client-bedrock-runtime',
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/util-dynamodb',
          '@aws-sdk/credential-provider-node',
          '@smithy/protocol-http',
          '@smithy/node-http-handler',
          '@smithy/signature-v4',
          '@aws-crypto/sha256-js'
        ]
      },
      environment: {
        DICTIONARY_TABLE: dictionaryTable.tableName,
        USER_PROGRESS_TABLE: userProgressTable.tableName,
        OPENSEARCH_ENDPOINT: osDomain.domainEndpoint,
        OS_ENDPOINT: osDomain.domainEndpoint,
        OS_REGION: this.region,
      },
    });

    fijianApiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:*::foundation-model/*']
    }));

    ragLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:*::foundation-model/*']
    }));

    // Grant permissions
    learningModulesTable.grantReadWriteData(processLearningModuleLambda);
    moduleVocabularyTable.grantReadWriteData(processLearningModuleLambda);
    verifiedTranslationsTable.grantReadWriteData(processLearningModuleLambda);
    verifiedVocabTable.grantReadWriteData(processLearningModuleLambda);
    dictionaryTable.grantReadWriteData(processLearningModuleLambda);
    userProgressTable.grantReadWriteData(processLearningModuleLambda);
    contentBucket.grantRead(processLearningModuleLambda);
    anthropicApiKeySecret.grantRead(processLearningModuleLambda);

    // Grant permissions for chat lambda
    userProgressTable.grantReadWriteData(fijianApiLambda);

    // Grant permissions for RAG lambda
    dictionaryTable.grantReadWriteData(ragLambda);
    userProgressTable.grantReadWriteData(ragLambda);

    // === REMOVED: Legacy lambda function permissions ===
    // All grant statements and policies for removed lambda functions

    // OpenSearch permissions
    processLearningModuleLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'es:ESHttpPost',
        'es:ESHttpPut',
        'es:ESHttpGet',
        'es:ESHttpDelete'
      ],
      resources: [`arn:aws:es:${this.region}:${this.account}:domain/${osDomain.domainName}/*`]
    }));

    ragLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'es:ESHttpPost',
        'es:ESHttpPut',
        'es:ESHttpGet',
        'es:ESHttpDelete'
      ],
      resources: [`arn:aws:es:${this.region}:${this.account}:domain/${osDomain.domainName}/*`]
    }));

    // === REMOVED: Legacy lambda OpenSearch permissions ===
    // Removed policies for deleted lambda functions

    // === REMOVED: S3 Event Notification for legacy lambda ===
    // S3 trigger for deleted load-learning-module-json lambda

    // === NEW: CloudWatch Dashboard for Monitoring ===
    const dashboard = new cloudwatch.Dashboard(this, 'LearningModulesDashboard', {
      dashboardName: 'fijian-learning-modules',
    });

    dashboard.addWidgets(
      new cloudwatch.LogQueryWidget({
        title: 'Module Processing Status',
        logGroupNames: [
          processLearningModuleLambda.logGroup.logGroupName,
          // Removed: loadLearningModuleJsonLambda.logGroup.logGroupName
        ],
        queryLines: [
          'fields @timestamp, @message',
          'filter @message like /Processing complete/',
          'stats count() by moduleId'
        ],
        width: 12,
        height: 6,
      })
    );


    // === API Gateway ===
    const unifiedApi = new apigateway.RestApi(this, 'fijian-ai-api', {
      restApiName: 'Fijian AI API',
      description: 'API for Fijian AI application',
      deployOptions: { stageName: 'prod' },
    });



    // === REMOVED: API endpoints for legacy lambda functions ===
    // All API Gateway integrations for removed lambda functions

    // === Chat and Learning endpoints ===
    const learnResource = unifiedApi.root.addResource('learn');
    learnResource.addMethod('GET', new apigateway.LambdaIntegration(fijianApiLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    learnResource.addMethod('POST', new apigateway.LambdaIntegration(fijianApiLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    addCorsOptions(learnResource);

    const chatResource = unifiedApi.root.addResource('chat');
    chatResource.addMethod('POST', new apigateway.LambdaIntegration(fijianApiLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    addCorsOptions(chatResource);

    // Chat history endpoint: GET /chat/history
    const chatHistoryResource = chatResource.addResource('history');
    chatHistoryResource.addMethod('GET', new apigateway.LambdaIntegration(fijianApiLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    addCorsOptions(chatHistoryResource);

    // Dictionary endpoints
    const dictionaryResource = unifiedApi.root.addResource('dictionary');
    
    // GET /dictionary/lookup
    const dictionaryLookupResource = dictionaryResource.addResource('lookup');
    dictionaryLookupResource.addMethod('GET', new apigateway.LambdaIntegration(ragLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    addCorsOptions(dictionaryLookupResource);

    // GET /dictionary/search  
    const dictionarySearchResource = dictionaryResource.addResource('search');
    dictionarySearchResource.addMethod('GET', new apigateway.LambdaIntegration(ragLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    addCorsOptions(dictionarySearchResource);

    // RAG endpoint: POST /rag/query
    const ragResource = unifiedApi.root.addResource('rag');
    const ragQueryResource = ragResource.addResource('query');
    ragQueryResource.addMethod('POST', new apigateway.LambdaIntegration(ragLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    addCorsOptions(ragQueryResource);

      // === NEW: API Endpoints for Learning Modules ===
      const modulesResource = unifiedApi.root.addResource('learning-modules');
      
      // GET /learning-modules/{moduleId}
      const moduleResource = modulesResource.addResource('{moduleId}');
      moduleResource.addMethod('GET', new apigateway.LambdaIntegration(processLearningModuleLambda), {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        requestParameters: {
          'method.request.path.moduleId': true
        }
      });
      addCorsOptions(moduleResource);

      // POST /learning-modules/process (manual trigger)
      const processResource = modulesResource.addResource('process');
      processResource.addMethod('POST', new apigateway.LambdaIntegration(processLearningModuleLambda), {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO
      });
      addCorsOptions(processResource);

      // === Outputs ===
      new cdk.CfnOutput(this, 'LearningModulesTableName', {
        value: learningModulesTable.tableName,
        description: 'Name of the Learning Modules DynamoDB table'
      });

      new cdk.CfnOutput(this, 'ModuleVocabularyTableName', {
        value: moduleVocabularyTable.tableName,
        description: 'Name of the Module Vocabulary DynamoDB table'
      });

      new cdk.CfnOutput(this, 'ManualUploadPath', {
        value: `s3://${contentBucket.bucketName}/manuals/`,
        description: 'S3 path for uploading manual pages'
      });

      new cdk.CfnOutput(this, 'UnifiedApiUrl', {
        value: unifiedApi.url,
        description: 'Base URL for the Unified API'
      });
  }
}
