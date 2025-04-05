// fijian-rag-app-stack.ts
import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Duration } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cdk from 'aws-cdk-lib';

const DOMAIN_NAME = 'fijian-language';

export class FijianRagStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1. S3 Buckets
    const contentBucket = new s3.Bucket(this, 'fijian-rag-app-content', {
      bucketName: 'fijian-rag-app-content',
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    const snapshotBucket = new s3.Bucket(this, 'fijian-rag-app-snapshots', {
      bucketName: 'fijian-rag-app-snapshots',
      removalPolicy: RemovalPolicy.RETAIN
    });

    // 2. IAM Roles
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const dashboardRole = new iam.Role(this, 'DashboardRole', {
      assumedBy: new iam.AccountPrincipal(this.account),
      roleName: 'OpenSearchDashboardRole'
    });

    const opensearchRole = new iam.Role(this, 'OpenSearchRole', {
      assumedBy: new iam.ServicePrincipal('opensearch.amazonaws.com')
    });

    // Grant OpenSearch role access to snapshot bucket
    snapshotBucket.grantReadWrite(opensearchRole);

    // 3. Cognito Setup
    const userPool = new cognito.UserPool(this, 'OpenSearchUserPool', {
      userPoolName: 'opensearch-user-pool',
      selfSignUpEnabled: false,
      signInAliases: {
        email: true
      }
    });

    const userPoolDomain = userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: 'fijian-language-opensearch'
      }
    });

    const userPoolClient = userPool.addClient('OpenSearchClient', {
      generateSecret: false,
      oAuth: {
        flows: {
          implicitCodeGrant: true
        },
        scopes: [cognito.OAuthScope.OPENID],
        callbackUrls: [
          'http://localhost:3000',
          `https://${DOMAIN_NAME}.${this.region}.opensearch.${this.urlSuffix}/_dashboards/app/home`
        ]
      }
    });

    const identityPool = new cognito.CfnIdentityPool(this, 'OpenSearchIdentityPool', {
      identityPoolName: 'opensearch-identity-pool',
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [{
        clientId: userPoolClient.userPoolClientId,
        providerName: userPool.userPoolProviderName,
        serverSideTokenCheck: true
      }]
    });

    const authenticatedRole = new iam.Role(this, 'CognitoAuthRole', {
      assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
        StringEquals: {
          'cognito-identity.amazonaws.com:aud': identityPool.ref
        },
        'ForAnyValue:StringLike': {
          'cognito-identity.amazonaws.com:amr': 'authenticated'
        }
      }, 'sts:AssumeRoleWithWebIdentity'),
    });

    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn
      }
    });

    // 4. OpenSearch Cognito Access Role
    const cognitoAccessForOpenSearchRole = new iam.Role(this, 'CognitoAccessForOpenSearch', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('opensearch.amazonaws.com'),
        new iam.ServicePrincipal('es.amazonaws.com')
      ),
      inlinePolicies: {
        'CognitoAccess': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cognito-idp:DescribeUserPool',
                'cognito-idp:CreateUserPoolClient',
                'cognito-idp:DeleteUserPoolClient',
                'cognito-idp:DescribeUserPoolClient',
                'cognito-idp:AdminInitiateAuth',
                'cognito-idp:AdminUserGlobalSignOut',
                'cognito-idp:ListUserPoolClients',
                'cognito-identity:DescribeIdentityPool',
                'cognito-identity:GetIdentityPoolRoles',
                'cognito-identity:GetCredentialsForIdentity',
                'cognito-identity:ListIdentityPools',
                'cognito-identity:ListIdentities',
                'cognito-identity:LookupDeveloperIdentity'
              ],
              resources: ['*']
            })
          ]
        })
      }
    });

    // Add required policies
    cognitoAccessForOpenSearchRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'sts:AssumeRole',
          'cognito-identity:*',
          'cognito-idp:*',
          'es:*',
          'es:ESHttp*'
        ],
        resources: ['*']
      })
    );

    // 5. Lambda Function (defined before domain)
    const handler = new lambda.Function(this, 'FijianRagHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'handler.main',
      role: lambdaRole,
      timeout: Duration.minutes(1),
      environment: {
        INDEX_NAME: 'translations'
      },
    });

    // 6. OpenSearch Domain (minimal configuration)
    const domain = new opensearch.Domain(this, 'OpenSearchDomain', {
      domainName: DOMAIN_NAME,
      version: opensearch.EngineVersion.OPENSEARCH_2_7,
      enableVersionUpgrade: true,
      capacity: {
        dataNodes: 1,
        dataNodeInstanceType: 't3.small.search',
        multiAzWithStandbyEnabled: false
      },
      ebs: {
        volumeSize: 10,
        volumeType: ec2.EbsDeviceVolumeType.GP3,
      },
      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true,
      },
      enforceHttps: true,
      fineGrainedAccessControl: {
        masterUserName: 'admin',
        masterUserPassword: cdk.SecretValue.unsafePlainText('Admin@123456')
      },
      cognitoDashboardsAuth: {
        identityPoolId: identityPool.ref,
        userPoolId: userPool.userPoolId,
        role: cognitoAccessForOpenSearchRole
      },
      automatedSnapshotStartHour: 0,
      vpc: undefined,
      removalPolicy: RemovalPolicy.DESTROY,
      accessPolicies: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['es:*'],
          principals: [
            new iam.ArnPrincipal(lambdaRole.roleArn),
            new iam.ArnPrincipal(dashboardRole.roleArn),
            new iam.ArnPrincipal(authenticatedRole.roleArn),
            new iam.ArnPrincipal(`arn:aws:iam::934889091214:user/tuitige`),
            new iam.ArnPrincipal(`arn:aws:iam::934889091214:user/tigeyoung`)
          ],
          resources: ['*']
        })
      ]
    });


    // Update Lambda environment with domain endpoint
    handler.addEnvironment('OPENSEARCH_DOMAIN_ENDPOINT', domain.domainEndpoint);

    // Grant necessary permissions
    domain.grantReadWrite(cognitoAccessForOpenSearchRole);
    domain.grantReadWrite(dashboardRole);
    domain.grantReadWrite(handler);

    // Add Lambda permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'es:ESHttp*',
        'es:Describe*',
        'es:List*'
      ],
      resources: [
        'arn:aws:bedrock:us-west-2::foundation-model/amazon.titan-embed-text-v1',
        'arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-v2',
        'arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0',
        domain.domainArn,
        `${domain.domainArn}/*`
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

    ['translate', 'verify', 'learn'].forEach(path => {
      api.root.addResource(path).addMethod('POST', new apigateway.LambdaIntegration(handler));
    });

    // 8. Outputs
    new CfnOutput(this, 'DashboardURLWithAuth', {
      value: `https://${domain.domainEndpoint}/_dashboards/?auth=1`,
      description: 'OpenSearch Dashboard URL with Auth'
    });

    new CfnOutput(this, 'DomainEndpoint', {
      value: domain.domainEndpoint,
      description: 'OpenSearch Domain Endpoint'
    });

    new CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL'
    });

    new CfnOutput(this, 'CognitoDomainUrl', {
      value: userPoolDomain.baseUrl(),
      description: 'Cognito Domain URL'
    });
  }
}
