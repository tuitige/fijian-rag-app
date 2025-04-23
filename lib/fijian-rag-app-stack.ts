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

    const COLLECTION_NAME = 'fijian-rag-collection';

    // 🔹 S3 Bucket

    const contentBucket = new s3.Bucket(this, 'ContentBucket', {
      bucketName: 'fijian-rag-app-content',
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 🔹 S3 Bucket for Snapshots
    const snapshotBucket = s3.Bucket.fromBucketName(this, 'SnapshotsBucket', 'fijian-rag-app-snapshots');
/*
    const snapshotBucket = new s3.Bucket(this, 'SnapshotsBucket', {
      bucketName: 'fijian-rag-app-snapshots',
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false
    });
*/

    // 🔹 OpenSearch Serverless (AOSS) Policies and Collection
/*    
    const encryptionPolicy = new opensearch.CfnSecurityPolicy(this, 'AossEncryptionPolicy', {
      name: 'fijian-rag-encryption',
      type: 'encryption',
      policy: JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: [`collection/${COLLECTION_NAME}`]
          },
        ],
        AWSOwnedKey: true,
      }),
    });

    const aossCollection = new opensearch.CfnCollection(this, 'AossCollection', {
      name: COLLECTION_NAME,
      type: 'VECTORSEARCH',
    });
    aossCollection.addDependency(encryptionPolicy);
*/

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

    const sharedEnv: { [key: string]: string } = {
      BUCKET_NAME: contentBucket.bucketName
    };

    // 🔸 Translate Agent Lambda
/*    const translateLambda = new NodejsFunction(this, 'TranslateLambda', {
      entry: path.join(__dirname, '../lambda/agents/translate-agent.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      role: lambdaRole,
      environment: sharedEnv
    });
*/
    // 🔸 Agent Router Lambda
    const agentRouterLambda  = new NodejsFunction(this, 'AgentRouterLambda', {
      entry: path.join(__dirname, '../lambda/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      role: lambdaRole,
      environment: sharedEnv,
      bundling: {
        externalModules: [], 
        nodeModules: ['@smithy/util-utf8'], 
      },
    });

    // 🔸 Textract Processor Lambda
    const textractLambda = new NodejsFunction(this, 'TextractLambda', {
      entry: path.join(__dirname, '../lambda/textractProcessor/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 1024,
      timeout: Duration.minutes(2),
      role: lambdaRole,
      environment: {
        ...sharedEnv,
        BUCKET_NAME: contentBucket.bucketName
      },
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
      bundling: {
        externalModules: [], // bundle everything
        nodeModules: ['uuid', '@aws-sdk/client-s3', '@aws-sdk/client-bedrock-runtime', '@aws-sdk/protocol-http', '@aws-sdk/signature-v4', '@aws-sdk/credential-provider-node', '@aws-crypto/sha256-js']
      },      
      environment: {
        ...sharedEnv,
        BUCKET_NAME: contentBucket.bucketName
      },
    });

    const getParagraphsLambda  = new NodejsFunction(this, 'getParagraphsLambda', {
      entry: path.join(__dirname, '../lambda/nailalakai/getParagraphsById.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      role: lambdaRole,
      bundling: {
        externalModules: [], // bundle everything
        nodeModules: ['uuid', '@aws-sdk/client-s3', '@aws-sdk/client-bedrock-runtime', '@aws-sdk/protocol-http', '@aws-sdk/signature-v4', '@aws-sdk/credential-provider-node', '@aws-crypto/sha256-js']
      },      
      environment: {
        ...sharedEnv,
        BUCKET_NAME: contentBucket.bucketName
      },
    });

    const listArticlesLambda = new NodejsFunction(this, 'ListArticlesLambda', {
      entry: path.join(__dirname, '../lambda/nailalakai/listArticles.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.minutes(1),
      memorySize: 512,
      role: lambdaRole,
      bundling: {
        externalModules: [],
        nodeModules: ['@aws-sdk/client-dynamodb']
      },
      environment: sharedEnv
    });
    
    const verifyParagraphLambda  = new NodejsFunction(this, 'verifyParagraphLambda', {
      entry: path.join(__dirname, '../lambda/nailalakai/verifyParagraph.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      role: lambdaRole,
      bundling: {
        externalModules: [], // bundle everything
        nodeModules: ['uuid', '@aws-sdk/client-s3', '@aws-sdk/client-bedrock-runtime', '@aws-sdk/protocol-http', '@aws-sdk/signature-v4', '@aws-sdk/credential-provider-node', '@aws-crypto/sha256-js']
      },      
      environment: {
        ...sharedEnv,
        BUCKET_NAME: contentBucket.bucketName
      },
    });


    const aggregatorLambda = new NodejsFunction(this, 'AggregatorLambda', {
      entry: path.join(__dirname, '../lambda/textractProcessor/aggregator.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      role: lambdaRole,
      bundling: {
        externalModules: [], // bundle everything
        nodeModules: ['uuid', '@aws-sdk/client-s3', '@aws-sdk/client-bedrock-runtime', '@aws-sdk/protocol-http', '@aws-sdk/signature-v4', '@aws-sdk/credential-provider-node', '@aws-crypto/sha256-js']
      },      
      environment: {
        ...sharedEnv,
        BUCKET_NAME: contentBucket.bucketName
      },
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
      domainName: 'fijian-rag-domain',
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

    sharedEnv['OPENSEARCH_ENDPOINT'] = osDomain.domainEndpoint;


    agentRouterLambda.addEnvironment('OPENSEARCH_ENDPOINT', osDomain.domainEndpoint);
    textractLambda.addEnvironment('OPENSEARCH_ENDPOINT', osDomain.domainEndpoint);
    aggregatorLambda.addEnvironment('OPENSEARCH_ENDPOINT', osDomain.domainEndpoint);
    ingestArticleLambda.addEnvironment('OPENSEARCH_ENDPOINT', osDomain.domainEndpoint);
    getParagraphsLambda.addEnvironment('OPENSEARCH_ENDPOINT', osDomain.domainEndpoint);
    verifyParagraphLambda.addEnvironment('OPENSEARCH_ENDPOINT', osDomain.domainEndpoint);

    const articleTable = new dynamodb.Table(this, 'ArticleVerificationTable', {
      tableName: 'ArticleVerificationTable',
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

    sharedEnv.DDB_TABLE_NAME  = articleTable.tableName;
    articleTable.grantReadWriteData(ingestArticleLambda);
    articleTable.grantReadWriteData(getParagraphsLambda);
    articleTable.grantReadWriteData(verifyParagraphLambda);
    articleTable.grantReadWriteData(aggregatorLambda);
    articleTable.grantReadWriteData(agentRouterLambda);
    articleTable.grantReadWriteData(textractLambda);
    articleTable.grantReadWriteData(listArticlesLambda);

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

    api.root.addResource('translate').addMethod('POST', new apigateway.LambdaIntegration(agentRouterLambda));
    api.root.addResource('verify').addMethod('POST', new apigateway.LambdaIntegration(agentRouterLambda));
    api.root.addResource('textract').addMethod('POST', new apigateway.LambdaIntegration(textractLambda));
        
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['es:*', 's3:*'],
      resources: ['*']
    }));    

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