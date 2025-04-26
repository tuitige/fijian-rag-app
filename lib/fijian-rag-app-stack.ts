import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
//import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { SecretValue } from 'aws-cdk-lib';

export class FijianRagAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const DDB_ARTICLE_VERIFICATION_TABLE = 'ArticleVerificationTable';
    const CONTENT_BUCKET_NAME = 'fijian-rag-app-content';
    const SNAPSHOTS_BUCKET_NAME = 'fijian-rag-app-snapshots';
    const OS_TRANSLATIONS_INDEX = 'translations';
    const OS_DOMAIN = 'fijian-rag-domain';

    // 🔹 S3 Bucket

    const contentBucket = new s3.Bucket(this, 'ContentBucket', {
      bucketName: CONTENT_BUCKET_NAME,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 🔹 S3 Bucket for Snapshots
    const snapshotBucket = s3.Bucket.fromBucketName(this, 'SnapshotsBucket', SNAPSHOTS_BUCKET_NAME);

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
      entry: path.join(__dirname, '../lambda/textractProcessor/index.ts'),
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
      entry: path.join(__dirname, '../lambda/textractProcessor/aggregator.ts'),
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


    contentBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(textractLambda),
      {
        prefix: '', // or use 'uploads/' if you want to scope it
        suffix: '.jpg'
      }
    );    

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

    const articleTable = new dynamodb.Table(this, DDB_ARTICLE_VERIFICATION_TABLE, {
      tableName: DDB_ARTICLE_VERIFICATION_TABLE,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN
    });
    
    // Optional: add GSI for verified = false
    articleTable.addGlobalSecondaryIndex({
      indexName: 'UnverifiedIndex',
      partitionKey: { name: 'verified', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    articleTable.grantReadWriteData(ingestArticleLambda);
    articleTable.grantReadWriteData(getParagraphsLambda);
    articleTable.grantReadWriteData(verifyParagraphLambda);
    articleTable.grantReadWriteData(aggregatorLambda);
    //articleTable.grantReadWriteData(agentRouterLambda);
    articleTable.grantReadWriteData(textractLambda);
    articleTable.grantReadWriteData(listArticlesLambda);

    const LearningModulesTable = new dynamodb.Table(this, 'LearningModulesTable', {
      tableName: 'LearningModulesTable',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN
    });

    LearningModulesTable.grantReadWriteData(getModuleByIdLambda);
    LearningModulesTable.grantReadWriteData(getModulePhrasesLambda);

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
    aggregateResource.addMethod('GET', new apigateway.LambdaIntegration(aggregatorLambda));

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
      OS_INDEX: OS_TRANSLATIONS_INDEX
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