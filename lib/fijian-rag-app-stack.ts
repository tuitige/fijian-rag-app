// fijian-rag-app-stack.ts
import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import { Duration } from 'aws-cdk-lib';
import * as amplify from '@aws-cdk/aws-amplify-alpha';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';

const COLLECTION_NAME = 'fijian-language';

export class FijianRagStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1. S3 Bucket
    const contentBucket = new s3.Bucket(this, 'fijian-language-learning', {
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

    // 3. Dashboard Role (moved up)
    const dashboardRole = new iam.Role(this, 'DashboardRole', {
      assumedBy: new iam.AccountPrincipal(this.account),
      roleName: 'OpenSearchDashboardRole'
    });

    // 3. OpenSearch Collection Policies (create before collection)
    const encryptionPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'EncryptionPolicy', {
      name: 'fijian-rag-encryption',
      type: 'encryption',
      policy: JSON.stringify({
        Rules: [{ ResourceType: 'collection', Resource: [`collection/${COLLECTION_NAME}`] }],
        AWSOwnedKey: true
      })
    });

// 1. Network Policy - Allow both public access and dashboard access
const networkPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'NetworkPolicy', {
  name: 'fijian-rag-network',
  type: 'network',
  description: 'Network policy for public access to collection and dashboard',
  policy: JSON.stringify([
    {
      Description: "Public access for both collection and dashboard",
      Rules: [
        {
          ResourceType: "dashboard",
          Resource: [
            `collection/${COLLECTION_NAME}`
          ]
        },
        {
          ResourceType: "collection",
          Resource: [
            `collection/${COLLECTION_NAME}`
          ]
        }
      ],
      AllowFromPublic: true
    }
  ])
});

// 2. Data Access Policy - Include both Lambda role and dashboard role
const dataAccessPolicy = new opensearchserverless.CfnAccessPolicy(this, 'DataAccessPolicy', {
  name: 'fijian-rag-data',
  type: 'data',
  description: 'Data access policy for collection and dashboard access',
  policy: JSON.stringify([
    {
      Description: "Full access policy for both roles",
      Rules: [
        {
          ResourceType: "collection",
          Resource: [`collection/${COLLECTION_NAME}`],
          Permission: [
            "aoss:CreateCollectionItems",
            "aoss:DeleteCollectionItems",
            "aoss:UpdateCollectionItems",
            "aoss:DescribeCollectionItems"
          ]
        },
        {
          ResourceType: "index",
          Resource: [`index/${COLLECTION_NAME}/*`],
          Permission: [
            "aoss:ReadDocument",
            "aoss:WriteDocument",
            "aoss:CreateIndex",
            "aoss:DeleteIndex",
            "aoss:UpdateIndex",
            "aoss:DescribeIndex"
          ]
        }
      ],
      Principal: [
        dashboardRole.roleArn,
        lambdaRole.roleArn,
        `arn:aws:iam::934889091214:user/tigeyoung`
      ]
    }
  ])
});


    // 4. OpenSearch Collection
    const collection = new opensearchserverless.CfnCollection(this, 'FijianCollection', {
      name: COLLECTION_NAME,
      type: 'VECTORSEARCH',
      description: 'Collection for Fijian language processing'
    });

    // Add dependencies to ensure policies are created before collection
    collection.addDependency(encryptionPolicy);
    collection.addDependency(networkPolicy);
    collection.addDependency(dataAccessPolicy);

    // 5. Dashboard Role
/*    
    const dashboardRole = new iam.Role(this, 'DashboardRole', {
      assumedBy: new iam.AccountPrincipal(this.account),
      roleName: 'OpenSearchDashboardRole'
    });
*/

// 4. Update Dashboard role permissions
dashboardRole.addToPolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: [
    'aoss:DashboardsAccessAll',
    'aoss:APIAccessAll'
  ],
  resources: [
    collection.attrArn,
    `arn:aws:aoss:${this.region}:${this.account}:dashboards/default`
  ]
}));

    // 6. Lambda Function
    const handler = new lambda.Function(this, 'FijianRagHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'handler.main',
      role: lambdaRole,
      timeout: Duration.minutes(1),
      environment: {
        OPENSEARCH_ENDPOINT: collection.attrCollectionEndpoint,
        COLLECTION_NAME: COLLECTION_NAME
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
        'arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0'
      ]
    }));

    // Add this to your Lambda role permissions in the CDK stack
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'aoss:APIAccessAll'
      ],
      resources: [
        collection.attrArn,
        `arn:aws:aoss:${this.region}:${this.account}:dashboards/default`
      ]
    }));

    // 7. API Gateway
    const api = new apigateway.RestApi(this, 'FijianRagApi', {
      restApiName: 'FijianLanguageService',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
      }
    });

    // Create API resources and methods
    const translateIntegration = new apigateway.LambdaIntegration(handler);
    const verifyIntegration = new apigateway.LambdaIntegration(handler);
    const learnIntegration = new apigateway.LambdaIntegration(handler);

    api.root.addResource('translate').addMethod('POST', translateIntegration);
    api.root.addResource('verify').addMethod('POST', verifyIntegration);
    api.root.addResource('learn').addMethod('POST', learnIntegration);

    // 8. Outputs
    new CfnOutput(this, 'CollectionEndpoint', {
      value: collection.attrCollectionEndpoint,
      description: 'OpenSearch Serverless Collection Endpoint'
    });

    new CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL'
    });

    new CfnOutput(this, 'DashboardRoleArn', {
      value: dashboardRole.roleArn,
      description: 'ARN of role to assume for dashboard access'
    });
  }
}
