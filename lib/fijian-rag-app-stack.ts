// lib/fijian-rag-app-stack.ts
import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';

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
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Add GSIs for queries
    translationsTable.addGlobalSecondaryIndex({
      indexName: 'VerifiedIndex',
      partitionKey: { name: 'verified', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
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

    // 4. IAM Roles
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    // Grant DynamoDB permissions
    translationsTable.grantReadWriteData(lambdaRole);

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

    // 5. Lambda Function
    const handler = new lambda.Function(this, 'FijianRagHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'handler.main',
      role: lambdaRole,
      timeout: Duration.minutes(1),
      environment: {
        TABLE_NAME: translationsTable.tableName,
        CONTENT_BUCKET: contentBucket.bucketName
      },
    });

    // 6. API Gateway
    const api = new apigateway.RestApi(this, 'FijianRagApi', {
      restApiName: 'FijianLanguageService',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
      }
    });

    ['translate', 'verify', 'learn'].forEach(path => {
      api.root.addResource(path).addMethod('POST', 
        new apigateway.LambdaIntegration(handler)
      );
    });

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
