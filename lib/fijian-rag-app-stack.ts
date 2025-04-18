import { Stack, StackProps, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

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

    // 🔹 DynamoDB
    const translationsTable = new dynamodb.Table(this, 'TranslationsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    translationsTable.addGlobalSecondaryIndex({
      indexName: 'learningModuleIndex',
      partitionKey: { name: 'learningModuleTitle', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 🔹 OpenSearch Serverless (AOSS) Policies and Collection
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

    // 🔹 IAM Role
    const lambdaRole = new iam.Role(this, 'SharedLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonTextractFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess')
      ]
    });

    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "aoss:CreateIndex",
        "aoss:UpdateIndex",
        "aoss:DeleteIndex",
        "aoss:ReadDocument",
        "aoss:WriteDocument",
        "aoss:DescribeIndex",
        "aoss:DescribeCollection"
      ],
      resources: [aossCollection.attrArn],
    }));

    const principals = [
      lambdaRole.roleArn,
      `arn:aws:iam::${Stack.of(this).account}:user/tigeyoung`
    ].filter(Boolean); 

    const accessPolicy = new opensearch.CfnAccessPolicy(this, 'AossAccessPolicy', {
      name: 'fijian-rag-access',
      type: 'data',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'index',
              Resource: [`index/${COLLECTION_NAME}/*`],
              Permission: [
                'aoss:DescribeIndex',
                'aoss:ReadDocument',
                'aoss:WriteDocument'
              ]
            },
          ],
          Principal: principals
        }
      ])
    });

    const networkPolicy = new opensearch.CfnSecurityPolicy(this, 'AossNetworkPolicy', {
      name: 'fijian-rag-network',
      type: 'network',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${COLLECTION_NAME}`]
            }            
          ],
          AllowFromPublic: true
        }
      ])
    });

    accessPolicy.addDependency(aossCollection);
    networkPolicy.addDependency(aossCollection);

/*    
    const dashboardAccessPolicy = new opensearch.CfnAccessPolicy(this, 'AossDashboardAccessPolicy', {
      name: 'fijian-rag-dashboard-access',
      type: 'data',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'dashboard',
              Resource: [`collection/${COLLECTION_NAME}`],
              Permission: ['aoss:DashboardsAccessAll']
            }
          ],
          Principal: [
            `arn:aws:iam::${Stack.of(this).account}:user/tigeyoung`
          ]
        }
      ])
    });
    dashboardAccessPolicy.addDependency(aossCollection);    
*/

    const sharedEnv = {
      BUCKET_NAME: contentBucket.bucketName,
      TRANSLATIONS_TABLE: translationsTable.tableName,
      AOSS_COLLECTION_ENDPOINT: `https://${aossCollection.attrCollectionEndpoint}`
    };

    // 🔹 Lambda Function
    const lambdaFn = new NodejsFunction(this, 'FijianAgentLambda', {
      entry: path.join(__dirname, '../lambda/aoss-rag/src/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.minutes(2),
      memorySize: 1024,
      role: lambdaRole,
      environment: sharedEnv
    });

    // 🔹 API Gateway
    const api = new apigateway.RestApi(this, 'FijianRagApi', {
      restApiName: 'Fijian RAG API',
      deployOptions: { stageName: 'prod' }
    });

    ['translate', 'verify', 'summary'].forEach(path => {
      api.root.addResource(path).addMethod('POST', new apigateway.LambdaIntegration(lambdaFn));
    });

    api.root.addResource('pages').addMethod('GET', new apigateway.LambdaIntegration(lambdaFn));
    api.root.addResource('module').addMethod('GET', new apigateway.LambdaIntegration(lambdaFn));
    api.root.addResource('verify-module').addMethod('POST', new apigateway.LambdaIntegration(lambdaFn));
  }
}