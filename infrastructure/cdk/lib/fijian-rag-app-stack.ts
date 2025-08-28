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
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as xray from 'aws-cdk-lib/aws-xray';

import { getProductionConfig, SECURITY_HEADERS } from './production-config';


export class FijianRagAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Get production configuration
    const context = {
      env: this.node.tryGetContext('env'),
      enableCustomDomains: this.node.tryGetContext('enableCustomDomains')
    };
    const config = getProductionConfig(context);
    
    const userPool = cognito.UserPool.fromUserPoolId(this, 'ExistingUserPool', 'us-west-2_shE3zxrwp');
    
    // Import existing User Pool Client
    const userPoolClient = cognito.UserPoolClient.fromUserPoolClientId(
      this, 
      'ExistingWebClient', 
      '4pvrvr5jf8h9bvi59asmlbdjcp'
    );

    // Create Cognito Domain for Hosted UI (if it doesn't already exist)
    const userPoolDomain = new cognito.UserPoolDomain(this, 'CognitoDomain', {
      userPool,
      cognitoDomain: {
        domainPrefix: 'fijian-auth', // This creates: fijian-auth.auth.us-west-2.amazoncognito.com
      },
    });

    const authorizer = new CognitoUserPoolsAuthorizer(this, 'FijianCognitoAuthorizer', {
      cognitoUserPools: [userPool]
    });

    // === SNS Topics for Alerts ===
    const alertTopic = new sns.Topic(this, 'ProductionAlerts', {
      displayName: 'Fijian RAG App Production Alerts',
    });

    // === Claude Secret for SDK ===
    const anthropicApiKeySecret = new secretsmanager.Secret(this, 'AnthropicApiKey', {
      secretName: 'AnthropicApiKey',
      description: 'API key for direct Claude access via SDK',
    });

    // === S3 Buckets ===
    const contentBucket = new s3.Bucket(this, 'ContentBucket', {
      removalPolicy: config.isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !config.isProduction,
      versioned: config.isProduction,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: config.isProduction ? [
        {
          id: 'delete-old-versions',
          expiredObjectDeleteMarker: true,
          noncurrentVersionExpiration: cdk.Duration.days(30),
        }
      ] : undefined,
    });

    // Frontend hosting bucket (for CloudFront)
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      removalPolicy: config.isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !config.isProduction,
      publicReadAccess: !config.isProduction, // Enable public read for dev
      blockPublicAccess: config.isProduction ? s3.BlockPublicAccess.BLOCK_ALL : s3.BlockPublicAccess.BLOCK_ACLS,
      encryption: s3.BucketEncryption.S3_MANAGED,
      websiteIndexDocument: !config.isProduction ? 'index.html' : undefined,
      websiteErrorDocument: !config.isProduction ? 'index.html' : undefined,
    });

    const trainingDataBucket = new s3.Bucket(this, 'TrainingDataBucket', {
      removalPolicy: config.isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !config.isProduction,
      versioned: config.isProduction,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
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
      removalPolicy: config.isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: config.backup.enablePointInTimeRecovery,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    const userProgressTable = new dynamodb.Table(this, 'UserProgressTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: config.isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: config.backup.enablePointInTimeRecovery,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
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
      tracing: config.monitoring.enableXRayTracing ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
      insightsVersion: config.monitoring.enableDetailedMonitoring ? lambda.LambdaInsightsVersion.VERSION_1_0_229_0 : undefined,
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
      tracing: config.monitoring.enableXRayTracing ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
      insightsVersion: config.monitoring.enableDetailedMonitoring ? lambda.LambdaInsightsVersion.VERSION_1_0_229_0 : undefined,
      bundling: {
        nodeModules: ['@aws-sdk/client-bedrock-runtime', '@aws-sdk/client-dynamodb', '@aws-sdk/util-dynamodb']
      },
      environment: {
        USER_PROGRESS_TABLE: userProgressTable.tableName,
        ENVIRONMENT: config.stage,
        ENABLE_XRAY: config.monitoring.enableXRayTracing.toString(),
      },
    });

    // === NEW: Lambda for RAG queries and dictionary operations ===
    const ragLambda = new lambdaNodejs.NodejsFunction(this, 'RagLambda', {
      entry: path.join(__dirname, '../../../backend/lambdas/rag/src/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(120),
      tracing: config.monitoring.enableXRayTracing ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
      insightsVersion: config.monitoring.enableDetailedMonitoring ? lambda.LambdaInsightsVersion.VERSION_1_0_229_0 : undefined,
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
      dashboardName: `fijian-learning-modules-${this.region}`,
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
      deployOptions: { 
        stageName: config.stage,
        tracingEnabled: config.monitoring.enableXRayTracing,
        metricsEnabled: config.monitoring.enableDetailedMonitoring,
        throttlingRateLimit: config.isProduction ? 1000 : 100,
        throttlingBurstLimit: config.isProduction ? 2000 : 200,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: config.security.corsOrigins,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: [
          'Content-Type', 
          'X-Amz-Date', 
          'Authorization', 
          'X-Api-Key',
          'Cache-Control',
          'Accept'
        ],
      },
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
    // Built-in CORS is configured above, no need for manual CORS

    const chatResource = unifiedApi.root.addResource('chat');
    chatResource.addMethod('POST', new apigateway.LambdaIntegration(fijianApiLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    // Built-in CORS is configured above, no need for manual CORS

    // Chat history endpoint: GET /chat/history
    const chatHistoryResource = chatResource.addResource('history');
    chatHistoryResource.addMethod('GET', new apigateway.LambdaIntegration(fijianApiLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    // Built-in CORS is configured above, no need for manual CORS

    // Chat streaming endpoint: POST /chat/stream
    const chatStreamResource = chatResource.addResource('stream');
    chatStreamResource.addMethod('POST', new apigateway.LambdaIntegration(fijianApiLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    // Built-in CORS is configured above, no need for manual CORS

    // Dictionary endpoints
    const dictionaryResource = unifiedApi.root.addResource('dictionary');
    
    // GET /dictionary/lookup
    const dictionaryLookupResource = dictionaryResource.addResource('lookup');
    dictionaryLookupResource.addMethod('GET', new apigateway.LambdaIntegration(ragLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    // Built-in CORS is configured above, no need for manual CORS

    // GET /dictionary/search  
    const dictionarySearchResource = dictionaryResource.addResource('search');
    dictionarySearchResource.addMethod('GET', new apigateway.LambdaIntegration(ragLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    // Built-in CORS is configured above, no need for manual CORS

    // RAG endpoint: POST /rag/query
    const ragResource = unifiedApi.root.addResource('rag');
    const ragQueryResource = ragResource.addResource('query');
    ragQueryResource.addMethod('POST', new apigateway.LambdaIntegration(ragLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    // Built-in CORS is configured above, no need for manual CORS

    // Progress endpoints
    const progressResource = unifiedApi.root.addResource('progress');
    
    // GET /progress/dashboard
    const progressDashboardResource = progressResource.addResource('dashboard');
    progressDashboardResource.addMethod('GET', new apigateway.LambdaIntegration(fijianApiLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    
    // GET /progress/stats
    const progressStatsResource = progressResource.addResource('stats');
    progressStatsResource.addMethod('GET', new apigateway.LambdaIntegration(fijianApiLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    
    // GET /progress/vocabulary
    const progressVocabularyResource = progressResource.addResource('vocabulary');
    progressVocabularyResource.addMethod('GET', new apigateway.LambdaIntegration(fijianApiLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    
    // GET /progress/achievements
    const progressAchievementsResource = progressResource.addResource('achievements');
    progressAchievementsResource.addMethod('GET', new apigateway.LambdaIntegration(fijianApiLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    
    // GET /progress/streak
    const progressStreakResource = progressResource.addResource('streak');
    progressStreakResource.addMethod('GET', new apigateway.LambdaIntegration(fijianApiLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    
    // POST /progress/practice-session
    const progressPracticeSessionResource = progressResource.addResource('practice-session');
    progressPracticeSessionResource.addMethod('POST', new apigateway.LambdaIntegration(fijianApiLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    
    // POST /progress/word-learned
    const progressWordLearnedResource = progressResource.addResource('word-learned');
    progressWordLearnedResource.addMethod('POST', new apigateway.LambdaIntegration(fijianApiLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    
    // POST /progress/chat-message
    const progressChatMessageResource = progressResource.addResource('chat-message');
    progressChatMessageResource.addMethod('POST', new apigateway.LambdaIntegration(fijianApiLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    // Built-in CORS is configured above, no need for manual CORS

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
      // Built-in CORS is configured above, no need for manual CORS

      // POST /learning-modules/process (manual trigger)
      const processResource = modulesResource.addResource('process');
      processResource.addMethod('POST', new apigateway.LambdaIntegration(processLearningModuleLambda), {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO
      });
      // Built-in CORS is configured above, no need for manual CORS

    // === CloudFront Distribution (Production Only) ===
    let cloudFrontDistribution: cloudfront.Distribution | undefined;
    if (config.security.enableCloudFront) {
      // Import existing SSL certificate from us-east-1 (only if custom domains are enabled)
      const certificate = config.domains.enableCustomDomains && config.domains.certificateArn 
        ? acm.Certificate.fromCertificateArn(
            this, 
            'ImportedSslCertificate', 
            config.domains.certificateArn
          )
        : undefined;

      const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
        securityHeadersBehavior: {
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.seconds(31536000),
            includeSubdomains: true,
            override: true,
          },
          contentTypeOptions: { override: true },
          frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
          xssProtection: { protection: true, modeBlock: true, override: true },
          referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
        },
      });

      // Build CloudFront distribution configuration
      const distributionConfig: cloudfront.DistributionProps = {
        ...(config.domains.enableCustomDomains && certificate ? {
          domainNames: config.domains.customDomains,
          certificate: certificate,
        } : {}),
        defaultBehavior: {
          origin: new origins.S3Origin(frontendBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        additionalBehaviors: {
          '/api/*': {
            origin: new origins.RestApiOrigin(unifiedApi),
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          },
        },
        defaultRootObject: 'index.html',
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: cdk.Duration.minutes(5),
          },
        ],
      };

      cloudFrontDistribution = new cloudfront.Distribution(this, 'FrontendDistribution', distributionConfig);
    }

    // === CloudWatch Monitoring & Alarms ===
    if (config.monitoring.enableDetailedMonitoring) {
      // API Gateway Alarms
      new cloudwatch.Alarm(this, 'ApiHighErrorRate', {
        metric: unifiedApi.metricClientError({
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5, // 5% error rate
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'API Gateway error rate is too high',
      });

      new cloudwatch.Alarm(this, 'ApiHighLatency', {
        metric: unifiedApi.metricLatency({
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: config.performance.apiResponseTarget,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'API Gateway latency is too high',
      });

      // Lambda Function Alarms
      [fijianApiLambda, ragLambda, processLearningModuleLambda].forEach((lambdaFunc, index) => {
        new cloudwatch.Alarm(this, `Lambda${index}Errors`, {
          metric: lambdaFunc.metricErrors({
            period: cdk.Duration.minutes(5),
          }),
          threshold: 5,
          evaluationPeriods: 2,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
          alarmDescription: `${lambdaFunc.functionName} has high error rate`,
        });

        new cloudwatch.Alarm(this, `Lambda${index}Duration`, {
          metric: lambdaFunc.metricDuration({
            period: cdk.Duration.minutes(5),
          }),
          threshold: lambdaFunc.timeout!.toMilliseconds() * 0.8, // Alert at 80% of timeout
          evaluationPeriods: 2,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
          alarmDescription: `${lambdaFunc.functionName} duration is approaching timeout`,
        });
      });

      // DynamoDB Throttling Alarm
      new cloudwatch.Alarm(this, 'DynamoDBThrottles', {
        metric: new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ThrottledRequests',
          dimensionsMap: {
            TableName: dictionaryTable.tableName,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'DynamoDB requests are being throttled',
      });
    }

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

      // Production-specific outputs
      new cdk.CfnOutput(this, 'Environment', {
        value: config.stage,
        description: 'Deployment environment'
      });

      new cdk.CfnOutput(this, 'FrontendBucketName', {
        value: frontendBucket.bucketName,
        description: 'S3 bucket for frontend hosting'
      });

      // Add website URL for dev environment
      if (!config.isProduction) {
        new cdk.CfnOutput(this, 'FrontendWebsiteUrl', {
          value: frontendBucket.bucketWebsiteUrl,
          description: 'S3 website URL for frontend (dev environment)'
        });
      }

      if (cloudFrontDistribution) {
        new cdk.CfnOutput(this, 'CloudFrontUrl', {
          value: `https://${cloudFrontDistribution.distributionDomainName}`,
          description: 'CloudFront distribution URL'
        });
        
        new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
          value: cloudFrontDistribution.distributionId,
          description: 'CloudFront distribution ID for cache invalidation'
        });
      }

      new cdk.CfnOutput(this, 'MonitoringEnabled', {
        value: config.monitoring.enableDetailedMonitoring.toString(),
        description: 'Whether detailed monitoring is enabled'
      });

      new cdk.CfnOutput(this, 'CustomDomainsEnabled', {
        value: config.domains.enableCustomDomains.toString(),
        description: 'Whether custom domains are enabled for CloudFront'
      });

      // === Cognito Configuration Outputs ===
      new cdk.CfnOutput(this, 'CognitoUserPoolId', {
        value: userPool.userPoolId,
        description: 'Cognito User Pool ID for frontend authentication'
      });

      new cdk.CfnOutput(this, 'CognitoClientId', {
        value: '4pvrvr5jf8h9bvi59asmlbdjcp', // Use the existing client ID
        description: 'Cognito User Pool Client ID for frontend authentication'
      });

      new cdk.CfnOutput(this, 'CognitoDomainUrl', {
        value: userPoolDomain.baseUrl(),
        description: 'Cognito Domain URL for Hosted UI authentication'
      });

      new cdk.CfnOutput(this, 'CognitoRegion', {
        value: this.region,
        description: 'AWS Region for Cognito User Pool'
      });
  }
}
