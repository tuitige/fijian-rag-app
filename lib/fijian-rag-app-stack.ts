import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { AttributeType, Table, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { SecretValue } from 'aws-cdk-lib';
import * as event_sources from 'aws-cdk-lib/aws-lambda-event-sources';

export class FijianRagAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const DDB_ARTICLE_VERIFICATION_TABLE = 'ArticleVerificationTable';
    const DDB_TRANSLATIONS_TABLE = 'TranslationsTable';
    const CONTENT_BUCKET_NAME = 'fijian-rag-app-content';
    const SNAPSHOTS_BUCKET_NAME = 'fijian-rag-app-snapshots';
    const OS_TRANSLATIONS_INDEX = 'translations';
    const WORKER_SQS_QUEUE_URL='FijianDataIngestionQueue';
    const OS_DOMAIN = 'fijian-rag-domain';

    // 🔹 S3 Bucket

    const contentBucket = new s3.Bucket(this, 'ContentBucket', {
      bucketName: CONTENT_BUCKET_NAME,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 🔹 S3 Bucket for Snapshots
    const snapshotBucket = s3.Bucket.fromBucketName(this, 'SnapshotsBucket', SNAPSHOTS_BUCKET_NAME);

    // SQS Queue for Ingestion
    const ingestionQueue = new sqs.Queue(this, WORKER_SQS_QUEUE_URL, {
      queueName: WORKER_SQS_QUEUE_URL,
      visibilityTimeout: Duration.minutes(5) // long enough for Claude API calls later
    });

    // 🔹 IAM Role
    const lambdaRole = new iam.Role(this, 'SharedLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonTextractFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonOpenSearchServiceFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess')
      ]
    });

    const principals = [
      lambdaRole.roleArn,
      `arn:aws:iam::${Stack.of(this).account}:user/tigeyoung`
    ].filter(Boolean); 

    // 🔸 Textract Processor Lambda
    const textractLambda = new NodejsFunction(this, 'TextractLambda', {
      entry: path.join(__dirname, '../lambda/data-ingest-pipeline/textractProcessor/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 1024,
      timeout: Duration.minutes(2),
      role: lambdaRole,
      environment: {},
      bundling: {
        externalModules: [], 
        nodeModules: ['@smithy/util-utf8'], 
      }
    });
    contentBucket.grantReadWrite(textractLambda);

    contentBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(textractLambda),
      {
        prefix: 'peace-corps/chapters/',  // Only trigger under Peace Corps folder
        suffix: '.jpg'                    // Only for JPG files
      }
    );

    const ingestArticleLambda = new NodejsFunction(this, 'ingestArticleLambda', {
      entry: path.join(__dirname, '../lambda/nailalakai/ingestArticle.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      role: lambdaRole,
      environment: {},
      bundling: {
        externalModules: [], // bundle everything
        nodeModules: ['uuid', '@aws-sdk/client-s3', '@aws-sdk/client-bedrock-runtime', '@aws-sdk/protocol-http', '@aws-sdk/signature-v4', '@aws-sdk/credential-provider-node', '@aws-crypto/sha256-js']
      },      
    });

    const getParagraphsLambda  = new NodejsFunction(this, 'getParagraphsLambda', {
      entry: path.join(__dirname, '../lambda/nailalakai/getParagraphsById.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      role: lambdaRole,
      environment: {},
      bundling: {
        externalModules: [], // bundle everything
        nodeModules: ['uuid', '@aws-sdk/client-s3', '@aws-sdk/client-bedrock-runtime', '@aws-sdk/protocol-http', '@aws-sdk/signature-v4', '@aws-sdk/credential-provider-node', '@aws-crypto/sha256-js']
      },      
    });

    const listArticlesLambda = new NodejsFunction(this, 'ListArticlesLambda', {
      entry: path.join(__dirname, '../lambda/nailalakai/listArticles.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.minutes(1),
      memorySize: 512,
      role: lambdaRole,
      environment: {},
      bundling: {
        externalModules: [],
        nodeModules: ['@aws-sdk/client-dynamodb']
      }
    });
    
    const verifyParagraphLambda  = new NodejsFunction(this, 'verifyParagraphLambda', {
      entry: path.join(__dirname, '../lambda/nailalakai/verifyParagraph.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      role: lambdaRole,
      environment: {},
      bundling: {
        externalModules: [], // bundle everything
        nodeModules: ['uuid', '@aws-sdk/client-s3', '@aws-sdk/client-bedrock-runtime', '@aws-sdk/protocol-http', '@aws-sdk/signature-v4', '@aws-sdk/credential-provider-node', '@aws-crypto/sha256-js']
      },      
    });


    const aggregatorLambda = new NodejsFunction(this, 'AggregatorLambda', {
      entry: path.join(__dirname, '../lambda/data-ingest-pipeline/aggregator/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      role: lambdaRole,
      environment: {},
      bundling: {
        externalModules: [], // bundle everything
        nodeModules: ['uuid', '@aws-sdk/client-s3', '@aws-sdk/client-bedrock-runtime', '@aws-sdk/protocol-http', '@aws-sdk/signature-v4', '@aws-sdk/credential-provider-node', '@aws-crypto/sha256-js']
      },      
    });

    const getModuleByIdLambda = new NodejsFunction(this, 'GetModuleByIdLambda', {
      entry: path.join(__dirname, '../lambda/learning-modules/getModuleById.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      role: lambdaRole,
      environment: {},
      bundling: {
        externalModules: [], // bundle everything
        nodeModules: ['uuid', '@aws-sdk/client-s3', '@aws-sdk/client-bedrock-runtime', '@aws-sdk/protocol-http', '@aws-sdk/signature-v4', '@aws-sdk/credential-provider-node', '@aws-crypto/sha256-js']
      }, 
    });
    
    // List Phrases for a Module
    const getModulePhrasesLambda = new NodejsFunction(this, 'GetModulePhrasesLambda', {
      entry: path.join(__dirname, '../lambda/learning-modules/getModulePhrases.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      role: lambdaRole,
      environment: {},
      bundling: {
        externalModules: [], // bundle everything
        nodeModules: ['uuid', '@aws-sdk/client-s3', '@aws-sdk/client-bedrock-runtime', '@aws-sdk/protocol-http', '@aws-sdk/signature-v4', '@aws-sdk/credential-provider-node', '@aws-crypto/sha256-js']
      },
    });
    
    // Verify Phrase from Module
    const verifyPhraseLambda = new NodejsFunction(this, 'VerifyPhraseLambda', {
      entry: path.join(__dirname, '../lambda/learning-modules/verifyPhrase.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      role: lambdaRole,
      environment: {},
      bundling: {
        externalModules: [],
        nodeModules: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-bedrock-runtime',
          '@aws-sdk/protocol-http',
          '@aws-sdk/signature-v4',
          '@aws-sdk/credential-provider-node',
          '@aws-crypto/sha256-js'
        ]
      }
    });

    const listLearningModulesLambda = new NodejsFunction(this, 'listLearningModulesLambda', {
      entry: path.join(__dirname, '../lambda/learning-modules/listLearningModules.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      role: lambdaRole,
      environment: {},
      bundling: {
        externalModules: [],
        nodeModules: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-bedrock-runtime',
          '@aws-sdk/protocol-http',
          '@aws-sdk/signature-v4',
          '@aws-sdk/credential-provider-node',
          '@aws-crypto/sha256-js'
        ]
      }
    });

    const learnLambda = new NodejsFunction(this, 'learnLambda', {
      entry: path.join(__dirname, '../lambda/learn/learn-handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      role: lambdaRole,
      environment: {},
      bundling: {
        externalModules: [],
        nodeModules: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-bedrock-runtime',
          '@aws-sdk/protocol-http',
          '@aws-sdk/signature-v4',
          '@aws-sdk/credential-provider-node',
          '@aws-crypto/sha256-js'
        ]
      }
    });    

    const ingestModuleLambda = new NodejsFunction(this, 'ingestModuleLambda', {
      entry: path.join(__dirname, '../lambda/ingest-module/ingest-module.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      role: lambdaRole,
      environment: {},
      bundling: {
        externalModules: [],
        nodeModules: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-bedrock-runtime',
          '@aws-sdk/protocol-http',
          '@aws-sdk/signature-v4',
          '@aws-sdk/credential-provider-node',
          '@aws-crypto/sha256-js'
        ]
      }
    });    

    const s3ToSqsLambda = new NodejsFunction(this, 'S3ToSqsTriggerLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/data-ingest-pipeline/s3ToSqsTrigger/index.ts'),
      role: lambdaRole,
      environment: {
        SQS_QUEUE_URL: ingestionQueue.queueUrl
      },
      memorySize: 1024,      
      bundling: {
        externalModules: [],
        nodeModules: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-bedrock-runtime',
          '@aws-sdk/protocol-http',
          '@aws-sdk/signature-v4',
          '@aws-sdk/credential-provider-node',
          '@aws-crypto/sha256-js'
        ]
      },      
      timeout: Duration.seconds(30),
    });
    
    // 3. Grant Lambda permission to send messages to SQS
    ingestionQueue.grantSendMessages(s3ToSqsLambda);
    
    // 4. Grant S3 permission to invoke the Lambda
    s3ToSqsLambda.addPermission('AllowS3Invoke', {
      principal: new iam.ServicePrincipal('s3.amazonaws.com'),
      sourceArn: contentBucket.bucketArn
    });

    contentBucket.grantRead(aggregatorLambda);
    ingestionQueue.grantSendMessages(aggregatorLambda);    

    // 5. Add S3 Event Notification (trigger Lambda on object created)
    contentBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(s3ToSqsLambda),
      {
        prefix: 'peace-corps/',  // Optional: only trigger on Peace Corps folder initially
        suffix: '.txt'           // Optional: only .txt files (aggregated chapter text)
      }
    );

    const ingestWorkerLambda = new NodejsFunction(this, 'ingestWorkerLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/data-ingest-pipeline/ingestWorker/index.ts'),
      role: lambdaRole,
      environment: {
        SQS_QUEUE_URL: ingestionQueue.queueUrl
      },
      memorySize: 1024,      
      bundling: {
        externalModules: [],
        nodeModules: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-bedrock-runtime',
          '@aws-sdk/protocol-http',
          '@aws-sdk/signature-v4',
          '@aws-sdk/credential-provider-node',
          '@aws-crypto/sha256-js'
        ]
      },      
      timeout: Duration.seconds(500),
    });

    // Connect Worker Lambda to Worker Queue
    ingestWorkerLambda.addEventSource(new event_sources.SqsEventSource(ingestionQueue, {
      batchSize: 1, // Process one message at a time
    }));
    
    // If Worker needs to download from S3
    contentBucket.grantRead(ingestWorkerLambda);

/*    
    contentBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(textractLambda),
      {
        prefix: '', // or use 'uploads/' if you want to scope it
        suffix: '.jpg'
      }
    );    
*/
    // 🔹 IAM Role for OpenSearch to access S3 for snapshots
    const snapshotRole = new iam.Role(this, 'FijianRag-Opensearch-Snapshots-Role', {
      roleName: 'FijianRag-Opensearch-Snapshots-Role',
      assumedBy: new iam.ServicePrincipal('es.amazonaws.com'),
      inlinePolicies: {
        S3SnapshotAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:ListBucket'
              ],
              resources: [
                snapshotBucket.bucketArn,
                `${snapshotBucket.bucketArn}/*`
              ]
            })
          ]
        })
      }
    });

    const masterRole = new iam.Role(this, 'OpenSearchAdminRole', {
      assumedBy: new iam.ArnPrincipal('arn:aws:iam::934889091214:user/tigeyoung'),
      roleName: 'OpenSearchAdminRole'
    });

    // 🔹 Provisioned OpenSearch Domain
    const osDomain = new opensearch.Domain(this, 'FijianRagDomain', {
      version: opensearch.EngineVersion.OPENSEARCH_2_11,
      domainName: OS_DOMAIN,
      removalPolicy: RemovalPolicy.DESTROY,
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
        masterUserPassword: SecretValue.unsafePlainText('MitiBeka!2#4!')
      },
      accessPolicies: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          principals: [lambdaRole],
          actions: ['es:*'],
          resources: ['*'],
        })
      ]
    });

    const TranslationTable = new dynamodb.Table(this, DDB_TRANSLATIONS_TABLE, {
      tableName: DDB_TRANSLATIONS_TABLE,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN
    });
    
    // Optional: add GSI for verified = false
    TranslationTable.addGlobalSecondaryIndex({
      indexName: 'UnverifiedIndex',
      partitionKey: { name: 'verified', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    TranslationTable.grantReadWriteData(ingestArticleLambda);
    TranslationTable.grantReadWriteData(getParagraphsLambda);
    TranslationTable.grantReadWriteData(verifyParagraphLambda);
    TranslationTable.grantReadWriteData(aggregatorLambda);
    //TranslationTable.grantReadWriteData(agentRouterLambda);
    TranslationTable.grantReadWriteData(textractLambda);
    TranslationTable.grantReadWriteData(listArticlesLambda);

    const LearningModulesTable = new dynamodb.Table(this, 'LearningModulesTable', {
      tableName: 'LearningModulesTable',
      partitionKey: { name: 'moduleId', type: AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN
    });

    LearningModulesTable.grantReadWriteData(getModuleByIdLambda);
    LearningModulesTable.grantReadWriteData(getModulePhrasesLambda);
    LearningModulesTable.grantReadWriteData(learnLambda);
    LearningModulesTable.grantReadWriteData(ingestArticleLambda);

    TranslationTable.grantReadWriteData(ingestWorkerLambda);
    LearningModulesTable.grantReadWriteData(ingestWorkerLambda);


    // 🔹 API Gateway
    const api = new apigateway.RestApi(this, 'FijianRagApi', {
      restApiName: 'Fijian RAG API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      },
      deployOptions: { stageName: 'prod' }
    });

    // NaiLalakai API Gateway
    const ingestArticleResource = api.root.addResource('ingest-article');
    ingestArticleResource.addMethod('POST', new apigateway.LambdaIntegration(ingestArticleLambda));

    const getParagraphsResource = api.root.addResource('get-paragraphs');
    getParagraphsResource.addMethod('GET', new apigateway.LambdaIntegration(getParagraphsLambda));

    const verifyParagraphResource = api.root.addResource('verify-paragraph');
    verifyParagraphResource.addMethod('POST', new apigateway.LambdaIntegration(verifyParagraphLambda));

    const aggregateResource = api.root.addResource('aggregate');
    aggregateResource.addMethod('POST', new apigateway.LambdaIntegration(aggregatorLambda));

    const listArticlesResource = api.root.addResource('list-articles');
    listArticlesResource.addMethod('GET', new apigateway.LambdaIntegration(listArticlesLambda));    

//    api.root.addResource('translate').addMethod('POST', new apigateway.LambdaIntegration(agentRouterLambda));
//    api.root.addResource('verify').addMethod('POST', new apigateway.LambdaIntegration(agentRouterLambda));
    api.root.addResource('textract').addMethod('POST', new apigateway.LambdaIntegration(textractLambda));

    // learning-modules API Gateway
    api.root.resourceForPath('get-module').addMethod('GET', new apigateway.LambdaIntegration(getModuleByIdLambda));
    api.root.resourceForPath('module-phrases').addMethod('GET', new apigateway.LambdaIntegration(getModulePhrasesLambda));
    api.root.resourceForPath('verify-phrase').addMethod('POST', new apigateway.LambdaIntegration(verifyPhraseLambda));
    api.root.resourceForPath('list-modules').addMethod('GET', new apigateway.LambdaIntegration(listLearningModulesLambda));

    // app learning
    api.root.addResource('learn').addMethod('POST', new apigateway.LambdaIntegration(learnLambda));    
    api.root.addResource('ingest-module').addMethod('POST', new apigateway.LambdaIntegration(ingestModuleLambda));

    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['es:*', 's3:*'],
      resources: ['*']
    }));    

    // Shared Environment Variables for Lambdas
    const sharedEnv = {
      DEFAULT_REGION: 'us-west-2',
      DDB_TABLE_NAME: DDB_ARTICLE_VERIFICATION_TABLE,
      DDB_LEARNING_MODULES_TABLE: 'LearningModulesTable',
      DDB_TRANSLATIONS_TABLE: 'TranslationsTable',
      BUCKET_NAME: contentBucket.bucketName,
      SNAPSHOTS_BUCKET_NAME,
      OPENSEARCH_ENDPOINT: osDomain.domainEndpoint,
      OS_INDEX: OS_TRANSLATIONS_INDEX,
      WORKER_SQS_QUEUE_URL: ingestionQueue.queueUrl,
      INGESTION_QUEUE_URL: ingestionQueue.queueUrl,
    };    

    for (const [key, val] of Object.entries(sharedEnv)) {
      ingestArticleLambda.addEnvironment(key, val);
      verifyParagraphLambda.addEnvironment(key, val);
      //agentRouterLambda.addEnvironment(key, val);
      textractLambda.addEnvironment(key, val);
      aggregatorLambda.addEnvironment(key, val);
      getParagraphsLambda.addEnvironment(key, val);
      getModuleByIdLambda.addEnvironment(key, val);
      getModulePhrasesLambda.addEnvironment(key, val);
      verifyPhraseLambda.addEnvironment(key, val);
      listArticlesLambda.addEnvironment(key, val);
      listLearningModulesLambda.addEnvironment(key, val);
      learnLambda.addEnvironment(key, val);
      ingestArticleLambda.addEnvironment(key, val);
    }

    // Output: OpenSearch domain endpoint
    new CfnOutput(this, 'OpenSearchEndpoint', {
      value: osDomain.domainEndpoint,
      exportName: 'OpenSearchDomainEndpoint'
    });

    // Output: API Gateway URL
    new CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url ?? 'API URL not available',
      exportName: 'FijianRagApiUrl'
    });

    // (Optional) Snapshot S3 Bucket
    new CfnOutput(this, 'SnapshotBucketName', {
      value: snapshotBucket.bucketName,
      exportName: 'SnapshotBucketName'
    });

    new CfnOutput(this, 'SnapshotRoleArn', {
      value: snapshotRole.roleArn
    });

  }
}