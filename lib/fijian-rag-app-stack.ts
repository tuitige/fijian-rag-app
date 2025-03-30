// fijian-rag-app-stack.ts
import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import { Duration } from 'aws-cdk-lib';

export class FijianRagStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1. S3 Bucket
    const contentBucket = new s3.Bucket(this, 'XXXXXXXXXXXXXXXXXXX', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // 2. Lambda Role (create first, needed for policies)
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    // 3. OpenSearch Collection (create before policies that need its ARN)
    const collection = new opensearchserverless.CfnCollection(this, 'FijianCollection', {
      name: 'fijian-language',
      type: 'VECTORSEARCH',
      description: 'Collection for Fijian language processing'
    });

    // 4. Dashboard Role (now we can use collection.attrArn)
    const dashboardRole = new iam.Role(this, 'DashboardRole', {
      assumedBy: new iam.AccountPrincipal(this.account),
      roleName: 'OpenSearchDashboardRole'
    });
    
    // Add required permissions directly instead of using a non-existent managed policy
    dashboardRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'aoss:APIAccessAll',
        'aoss:DashboardsAccessAll',
        'aoss:ListCollections',
        'aoss:BatchGetCollection',
        'aoss:CreateCollection',
        'aoss:DeleteCollection',
        'aoss:UpdateCollection'
      ],
      resources: ['*']
    }));
    
    // Add specific collection permissions
    dashboardRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'aoss:ReadDocument',
        'aoss:WriteDocument',
        'aoss:CreateIndex',
        'aoss:DeleteIndex',
        'aoss:UpdateIndex',
        'aoss:DescribeIndex'
      ],
      resources: [collection.attrArn]
    }));

    // 5. OpenSearch Policies
    const encryptionPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'EncryptionPolicy', {
      name: 'fijian-rag-encryption',
      type: 'encryption',
      policy: JSON.stringify({
        Rules: [{ ResourceType: 'collection', Resource: ['collection/fijian-language'] }],
        AWSOwnedKey: true
      })
    });

    const networkPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'NetworkPolicy', {
      name: 'fijian-rag-network',
      type: 'network',
      policy: JSON.stringify([
        {
          Description: "Public access for collection",
          Rules: [
            {
              ResourceType: "collection",
              Resource: ["collection/fijian-language"]
            },
            {
              ResourceType: "dashboard",
              Resource: ["collection/fijian-language"]
            }
          ],
          AllowFromPublic: true
        }
      ])
    });
        

    const dataAccessPolicy = new opensearchserverless.CfnAccessPolicy(this, 'DataAccessPolicy', {
      name: 'fijian-rag-data',
      type: 'data',
      policy: JSON.stringify([{
        Rules: [{
          ResourceType: 'index',
          Resource: ['index/fijian-language/*'],
          Permission: [
            'aoss:ReadDocument',
            'aoss:WriteDocument',
            'aoss:CreateIndex',
            'aoss:DeleteIndex',
            'aoss:UpdateIndex',
            'aoss:DescribeIndex'
          ]
        }],
        Principal: [lambdaRole.roleArn]
      }])
    });

    // Add dependencies
    collection.addDependency(encryptionPolicy);
    collection.addDependency(networkPolicy);
    collection.addDependency(dataAccessPolicy);

    // 6. Lambda Function
    const handler = new lambda.Function(this, 'FijianRagHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'handler.main',
      role: lambdaRole,
      timeout: Duration.minutes(1),
      environment: {
        OPENSEARCH_ENDPOINT: collection.attrCollectionEndpoint,
        //AWS_REGION: this.region,
        COLLECTION_NAME: 'fijian-language'
      },
    });

    // Add bedrock permissions to lambdaRole
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel'
      ],
      resources: [
        'arn:aws:bedrock:us-west-2::foundation-model/amazon.titan-embed-text-v1',
        'arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-v2',
        'arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0'  // If using Claude
      ]
    }));

    // Add AOSS permissions to lambdaRole
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'aoss:APIAccessAll',
        'aoss:BatchGetCollection',
        'aoss:ReadDocument',
        'aoss:WriteDocument',
        'aoss:CreateIndex',
        'aoss:DeleteIndex',
        'aoss:UpdateIndex',
        'aoss:DescribeIndex'
      ],
      resources: [collection.attrArn]
    }));

    // 7. API Gateway
    const api = new apigateway.RestApi(this, 'FijianRagApi', {
      restApiName: 'FijianRagService',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
      }
    });

    const ragIntegration = new apigateway.LambdaIntegration(handler);
    api.root.addResource('rag').addMethod('POST', ragIntegration);
    api.root.addResource('search').addMethod('POST', ragIntegration);
    api.root.addResource('verify').addMethod('POST', ragIntegration);

    // 8. Outputs
    new CfnOutput(this, 'CollectionEndpoint', {
      value: collection.attrCollectionEndpoint,
      description: 'OpenSearch Serverless Collection Endpoint'
    });

    new CfnOutput(this, 'FijianApiUrl', {
      value: api.url,
      description: 'API Gateway base URL',
    });

    new CfnOutput(this, 'DashboardRoleArn', {
      value: dashboardRole.roleArn,
      description: 'ARN of role to assume for dashboard access'
    });
  }
}
