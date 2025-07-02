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
            'method.response.header.Access-Control-Allow-Origin': "'*'",
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
        TRAINING_BUCKET: trainingDataBucket.bucketName,
        TRANSLATION_QUALITY_TABLE: translationQualityTable.tableName
      },
    });

    translationsReviewTable.grantReadWriteData(ingestLambda);
    verifiedTranslationsTable.grantReadWriteData(ingestLambda);
    verifiedVocabTable.grantReadWriteData(ingestLambda);
    contentBucket.grantReadWrite(ingestLambda);
    trainingDataBucket.grantReadWrite(ingestLambda);
    verifiedParagraphsTable.grantReadWriteData(ingestLambda);
    translationQualityTable.grantReadData(ingestLambda);

    ingestLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:*::foundation-model/*']
    }));

    // === Lambda: ingestion-agent ===
    const ingestionAgent = new lambdaNodejs.NodejsFunction(this, 'IngestionAgentLambda', {
      entry: path.join(__dirname, '../lambda/ingestion-agent/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(120),
      bundling: {
        nodeModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/client-lambda']
      },
      environment: {
        ARTICLE_QUEUE_TABLE: articleQueueTable.tableName,
        INGESTION_FUNCTION_NAME: ingestLambda.functionName
      },
    });

    articleQueueTable.grantReadWriteData(ingestionAgent);
    ingestLambda.grantInvoke(ingestionAgent);

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
        ENABLE_AUTO_VALIDATION: 'true'
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

    // === NEW: Lambda for Processing Learning Modules ===
    const processLearningModuleLambda = new lambdaNodejs.NodejsFunction(this, 'ProcessLearningModuleLambda', {
      entry: path.join(__dirname, '../lambda/process-learning-module/index.ts'),
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
        OS_ENDPOINT: osDomain.domainEndpoint,
        OS_REGION: this.region,
        ANTHROPIC_SECRET_ARN: anthropicApiKeySecret.secretArn,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const loadLearningModuleJsonLambda = new lambdaNodejs.NodejsFunction(this, 'LoadLearningModuleJsonLambda', {
      entry: path.join(__dirname, '../lambda/load-learning-module-json/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(300),
      bundling: {
        nodeModules: [
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
        OS_ENDPOINT: osDomain.domainEndpoint,
        OS_REGION: this.region
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const mergePagesLambda = new lambdaNodejs.NodejsFunction(this, 'MergePagesLambda', {
      entry: path.join(__dirname, '../lambda/merge-pages/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(300),
      bundling: {
        nodeModules: ['@aws-sdk/client-s3']
      },
      environment: {
        CONTENT_BUCKET: contentBucket.bucketName
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // === NEW: Lambda for chat and learn endpoints ===
    const fijianApiLambda = new lambdaNodejs.NodejsFunction(this, 'FijianApiLambda', {
      entry: path.join(__dirname, '../lambda/fijian/src/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      bundling: {
        nodeModules: ['@aws-sdk/client-bedrock-runtime']
      },
    });

    fijianApiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:*::foundation-model/*']
    }));

    // Grant permissions
    learningModulesTable.grantReadWriteData(processLearningModuleLambda);
    moduleVocabularyTable.grantReadWriteData(processLearningModuleLambda);
    verifiedTranslationsTable.grantReadWriteData(processLearningModuleLambda);
    verifiedVocabTable.grantReadWriteData(processLearningModuleLambda);
    contentBucket.grantRead(processLearningModuleLambda);
    anthropicApiKeySecret.grantRead(processLearningModuleLambda);

    learningModulesTable.grantReadWriteData(loadLearningModuleJsonLambda);
    moduleVocabularyTable.grantReadWriteData(loadLearningModuleJsonLambda);
    verifiedTranslationsTable.grantReadWriteData(loadLearningModuleJsonLambda);
    verifiedVocabTable.grantReadWriteData(loadLearningModuleJsonLambda);
    contentBucket.grantRead(loadLearningModuleJsonLambda);
    contentBucket.grantReadWrite(mergePagesLambda);

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

    loadLearningModuleJsonLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'es:ESHttpPost',
        'es:ESHttpPut',
        'es:ESHttpGet',
        'es:ESHttpDelete'
      ],
      resources: [`arn:aws:es:${this.region}:${this.account}:domain/${osDomain.domainName}/*`]
    }));

    // === S3 Event Notification for chapter.json uploads ===
    contentBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(loadLearningModuleJsonLambda),
      {
        prefix: 'manuals/',
        suffix: 'chapter.json'
      }
    );

    // === NEW: CloudWatch Dashboard for Monitoring ===
    const dashboard = new cloudwatch.Dashboard(this, 'LearningModulesDashboard', {
      dashboardName: 'fijian-learning-modules',
    });

    dashboard.addWidgets(
      new cloudwatch.LogQueryWidget({
        title: 'Module Processing Status',
        logGroupNames: [
          processLearningModuleLambda.logGroup.logGroupName,
          loadLearningModuleJsonLambda.logGroup.logGroupName
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

    // === Securely Generate API Key (no hardcoded string) ===
    const apiKey = unifiedApi.addApiKey('UnifiedAgentApiKey', {
      description: 'API Key for accessing /verify and /ingest endpoints'
    });

    const usagePlan = unifiedApi.addUsagePlan('UnifiedAgentUsagePlan', {
      name: 'AgentUsagePlan',
      apiStages: [{ api: unifiedApi, stage: unifiedApi.deploymentStage }],
    });
    usagePlan.addApiKey(apiKey);

    anthropicApiKeySecret.grantRead(ingestLambda);
    ingestLambda.addEnvironment('ANTHROPIC_SECRET_ARN', anthropicApiKeySecret.secretArn);

    // === /ingest endpoint ===
    const ingestResource = unifiedApi.root.addResource('ingest');
    ingestResource.addMethod('POST', new apigateway.LambdaIntegration(ingestLambda), {
      apiKeyRequired: true,
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    addCorsOptions(ingestResource);

    // === /verify-items endpoint ===
    const verifyResource = unifiedApi.root.addResource('verify-items');
    verifyResource.addMethod('GET', new apigateway.LambdaIntegration(verifyHandler), {
      apiKeyRequired: true
    });

    addCorsOptions(verifyResource);


    // === /verify-item endpoint ===
    const submitVerifyResource = unifiedApi.root.addResource('verify-item');
    submitVerifyResource.addMethod('POST', new apigateway.LambdaIntegration(verifyHandler), {
      apiKeyRequired: true,
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });

    addCorsOptions(submitVerifyResource);

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

      // === NEW: API Endpoints for Learning Modules ===
      const modulesResource = unifiedApi.root.addResource('learning-modules');
      
      // GET /learning-modules/{moduleId}
      const moduleResource = modulesResource.addResource('{moduleId}');
      moduleResource.addMethod('GET', new apigateway.LambdaIntegration(processLearningModuleLambda), {
        apiKeyRequired: true,
        requestParameters: {
          'method.request.path.moduleId': true
        }
      });
      addCorsOptions(moduleResource);

      // POST /learning-modules/process (manual trigger)
      const processResource = modulesResource.addResource('process');
      processResource.addMethod('POST', new apigateway.LambdaIntegration(processLearningModuleLambda), {
        apiKeyRequired: true,
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
