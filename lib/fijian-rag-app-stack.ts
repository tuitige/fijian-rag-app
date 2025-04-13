// lib/fijian-rag-app-stack.ts
import * as path from 'path';
import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejsLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';

export class FijianRagStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const COLLECTION_NAME = 'fijiantranslations';

    // 1. S3 Bucket
    const contentBucket = new s3.Bucket(this, 'fijian-rag-app-content', {
      bucketName: 'fijian-rag-app-content',
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // 2. Security Policies
    const encryptionPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'EncryptionPolicy', {
      name: 'fijian-translations-encryption',
      type: 'encryption',
      description: 'Encryption policy for Fijian translations collection',
      policy: JSON.stringify({
        Rules: [{ ResourceType: 'collection', Resource: [`collection/${COLLECTION_NAME}`] }],
        AWSOwnedKey: true
      })
    });

    const networkPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'NetworkPolicy', {
      name: 'fijian-translations-network',
      type: 'network',
      description: 'Network policy for Fijian translations collection and dashboards',
      policy: JSON.stringify([
        {
          Description: 'Allow public access to collection and dashboard',
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${COLLECTION_NAME}`]
            },
            {
              ResourceType: 'dashboard',
              Resource: [`collection/${COLLECTION_NAME}`]
            }
          ],
          AllowFromPublic: true
        }
      ])
    });
        
    // 3. Collection
    const collection = new opensearchserverless.CfnCollection(this, 'FijianCollection', {
      name: COLLECTION_NAME,
      description: 'Collection for Fijian language translations and learning modules',
      type: 'SEARCH'
    });

    collection.addDependency(encryptionPolicy);
    collection.addDependency(networkPolicy);

    // 4. Lambda Roles
    const translatorLambdaRole = new iam.Role(this, 'TranslatorLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const collectionManagerRole = new iam.Role(this, 'CollectionManagerRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    // Add this new OpenSearch policy statement here
    const openSearchPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'aoss:APIAccessAll',
        'aoss:CreateCollection',
        'aoss:DeleteCollection',
        'aoss:GetCollection',
        'aoss:CreateSecurityPolicy',
        'aoss:GetSecurityPolicy',
        'aoss:ListCollections',
        'aoss:BatchGetCollection',
        'aoss:CreateAccessPolicy',
        'aoss:GetAccessPolicy',
        'aoss:ListAccessPolicies'
      ],
      resources: [
        `arn:aws:aoss:${this.region}:${this.account}:collection/${collection.name}`,
        `arn:aws:aoss:${this.region}:${this.account}:collection/${collection.name}/*`,
        collection.attrArn,
        `${collection.attrArn}/*`
      ]
    });

    const translatorOpenSearchAccess = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'aoss:APIAccessAll',
        'aoss:ReadDocument',
        'aoss:WriteDocument',
        'aoss:CreateIndex',
        'aoss:DeleteIndex',
        'aoss:UpdateIndex',
        'aoss:DescribeIndex'
      ],
      resources: [
        `arn:aws:aoss:${this.region}:${this.account}:collection/${COLLECTION_NAME}`,
        `arn:aws:aoss:${this.region}:${this.account}:collection/${COLLECTION_NAME}/*`,
        collection.attrArn,
        `${collection.attrArn}/*`
      ]
    });
    
    translatorLambdaRole.addToPolicy(translatorOpenSearchAccess);    
    translatorLambdaRole.addToPolicy(openSearchPolicyStatement);

    const collectionManagerLambda = new nodejsLambda.NodejsFunction(this, 'CollectionManager', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../lambda/collection-manager/handler.ts'),
      handler: 'handler',
      role: collectionManagerRole,
      environment: {
        COLLECTION_NAME: collection.name,
        COLLECTION_ENDPOINT: collection.attrCollectionEndpoint
      },
      bundling: {
        minify: true,
        sourceMap: false,
        externalModules: [
          'aws-sdk'
        ],
        nodeModules: [
          '@smithy/signature-v4',
          '@aws-sdk/client-opensearch'
        ],
        format: nodejsLambda.OutputFormat.CJS
      }
    });

    const translatorLambda = new nodejsLambda.NodejsFunction(this, 'TranslatorHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../lambda/agents/translator/handler.ts'),
      handler: 'handler',
      role: translatorLambdaRole,
      environment: {
        COLLECTION_ENDPOINT: collection.attrCollectionEndpoint,
        COLLECTION_NAME: collection.name
      },
      timeout: Duration.minutes(5),
      bundling: {
        minify: true,
        sourceMap: false,
        externalModules: [
          'aws-sdk'
        ],
        nodeModules: [
          '@smithy/signature-v4',
          '@aws-sdk/client-opensearchserverless',
          '@aws-sdk/client-bedrock-runtime',
          '@smithy/protocol-http',      // Add these
          '@aws-crypto/sha256-js',      // new dependencies
          '@aws-sdk/credential-provider-node'
        ],
        format: nodejsLambda.OutputFormat.CJS
      }
    });

   // 5. Data Access Policy
   const principals = [
    translatorLambda.role?.roleArn,
    collectionManagerLambda.role?.roleArn,
    `arn:aws:iam::${Stack.of(this).account}:user/tigeyoung`
  ].filter(Boolean); 

  const dataAccessPolicy = new opensearchserverless.CfnAccessPolicy(this, 'DataAccessPolicy', {
    name: 'collection-access-policy',
    type: 'data',
    description: 'Access policy for Fijian translations collection',
    policy: JSON.stringify([
      {
        Description: 'Access policy for collection',
        Rules: [
          {
            ResourceType: 'index',
            Resource: [`index/${COLLECTION_NAME}/*`],
            Permission: [
              'aoss:ReadDocument',
              'aoss:WriteDocument',
              'aoss:CreateIndex',
              'aoss:DeleteIndex',
              'aoss:UpdateIndex',
              'aoss:DescribeIndex'
            ]
          },
          {
            ResourceType: 'collection',
            Resource: [`collection/${COLLECTION_NAME}`],
            Permission: [
              'aoss:CreateCollectionItems',
              'aoss:DeleteCollectionItems',
              'aoss:UpdateCollectionItems',
              'aoss:DescribeCollectionItems'
            ]
          }
        ],
        Principal: principals
      }
    ])
  });
  
  
  // Add dependency
  dataAccessPolicy.addDependency(collection);    

    // 6. Add OpenSearch permissions to roles
    translatorLambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'aoss:APIAccessAll',
        'aoss:ReadDocument',
        'aoss:WriteDocument',
        'aoss:CreateIndex',
        'aoss:DeleteIndex',
        'aoss:UpdateIndex',
        'aoss:DescribeIndex'
      ],
      resources: [collection.attrArn]
    }));

    collectionManagerRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'aoss:APIAccessAll',
        'aoss:CreateCollectionItems',
        'aoss:DeleteCollectionItems',
        'aoss:UpdateCollectionItems',
        'aoss:DescribeCollectionItems',
        'aoss:ReadCollectionItems'
      ],
      resources: [collection.attrArn]
    }));

    // 7. Lambda Functions

    // 8. Cognito User Pool
/*    const userPool = new cognito.UserPool(this, 'FijianUserPool', {
      userPoolName: 'fijian-translations-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true }
      }
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'FijianUserPoolClient', {
      userPool,
      generateSecret: false
    });
*/
    // 9. API Gateway with APIKEY Authorizer
    const api = new apigateway.RestApi(this, 'FijianAPI', {
      restApiName: 'Fijian Translations API',
      deploy: true,
      deployOptions: {
        stageName: 'prod',
      }
    });

    // Create API key
    const apiKey = api.addApiKey('FijianApiKey', {
      apiKeyName: 'fijian-translations-key',
      description: 'API Key for Fijian Translations API'
    });

    // Create usage plan
    const usagePlan = api.addUsagePlan('FijianUsagePlan', {
      name: 'FijianUsagePlan',
      apiStages: [{
        api: api,
        stage: api.deploymentStage
      }]
    });

    // Associate API key with usage plan
    usagePlan.addApiKey(apiKey);
/*
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'FijianAuthorizer', {
      cognitoUserPools: [userPool]
    });
*/
    // 10. API Resources and Methods
    const translations = api.root.addResource('translations');
    
    translations.addMethod('POST', 
      new apigateway.LambdaIntegration(translatorLambda),
      {
        apiKeyRequired: true
      }
    );

    translations.addMethod('GET',
      new apigateway.LambdaIntegration(collectionManagerLambda),
      {
        apiKeyRequired: true
      }
    );

    // Logging in CW
    translatorLambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccess')
    );

    // 11. Add Bedrock permissions
    translatorLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0']
    }));

    //collection.addDependency(encryptionPolicy);
    //collection.addDependency(networkPolicy);
    //dataAccessPolicy.addDependency(collection);
    translatorLambda.node.addDependency(dataAccessPolicy);
    collectionManagerLambda.node.addDependency(dataAccessPolicy);

    // 12. Outputs
    //new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    //new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, 'ApiUrl', { value: api.url });
    new CfnOutput(this, 'CollectionEndpoint', { value: collection.attrCollectionEndpoint });
    new CfnOutput(this, 'ApiKeyValue', {value: apiKey.keyId, description: 'API Key ID - use aws apigateway get-api-key --api-key <key-id> --include-value to get the value'
    });
  }
}
