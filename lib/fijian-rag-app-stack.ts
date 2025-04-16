import { Stack, StackProps, Duration, RemovalPolicy, Fn } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export class FijianRagAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // -------------------------------------------------------------------------
    // 1. S3 Bucket for scanned pages and Claude-generated modules
    // -------------------------------------------------------------------------
    const contentBucket = new s3.Bucket(this, 'ContentBucket', {
      bucketName: 'fijian-rag-app-content',
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // -------------------------------------------------------------------------
    // 2. Unified DynamoDB Table for translations and learning modules
    // -------------------------------------------------------------------------
    const translationsTable = new dynamodb.Table(this, 'TranslationsTable', {
      tableName: 'TranslationsTable',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    });

    translationsTable.addGlobalSecondaryIndex({
      indexName: 'SourceLanguageIndex',
      partitionKey: { name: 'sourceLanguage', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    translationsTable.addGlobalSecondaryIndex({
      indexName: 'learningModuleIndex',
      partitionKey: { name: 'learningModuleTitle', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // -------------------------------------------------------------------------
    // 3. IAM Role shared by Lambdas
    // -------------------------------------------------------------------------
    const lambdaRole = new iam.Role(this, 'SharedLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    });
    
    lambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
    );
    
    contentBucket.grantReadWrite(lambdaRole);
    translationsTable.grantReadWriteData(lambdaRole);
    
    // Allow invocation of Claude generator lambda (without creating circular dependency)
    lambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [Fn.sub('arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:ClaudeModuleGeneratorLambda')]
    }));
    
    // Allow future Bedrock agent interactions
    lambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'] // refine to specific model ARN in prod if needed
    }));
    

    // -------------------------------------------------------------------------
    // 4. Lambdas (organized for modular, agent-ready architecture)
    // -------------------------------------------------------------------------
    const fijianLambda = new NodejsFunction(this, 'FijianHandler', {
      entry: path.join(__dirname, '../lambda/fijian-agent/src/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        TRANSLATIONS_TABLE: translationsTable.tableName
      },
      role: lambdaRole
    });

    const textractProcessor = new NodejsFunction(this, 'TextractProcessor', {
      entry: path.join(__dirname, '../lambda/textract-agent/src/textract-processor.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        TABLE_NAME: translationsTable.tableName,
        S3_BUCKET: contentBucket.bucketName
      },
      role: lambdaRole
    });

    const textractAggregatorFn = new NodejsFunction(this, 'TextractAggregatorLambda', {
      entry: path.join(__dirname, '../lambda/textract-agent/src/textract-aggregator.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        BUCKET_NAME: contentBucket.bucketName,
        CLAUDE_MODULE_GENERATOR_FN: 'ClaudeModuleGeneratorLambda'
      },
      role: lambdaRole
    });

    const moduleGeneratorFn = new NodejsFunction(this, 'ClaudeModuleGeneratorLambda', {
      entry: path.join(__dirname, '../lambda/textract-agent/src/claude-module-generator.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        TABLE_NAME: translationsTable.tableName,
        BUCKET_NAME: contentBucket.bucketName
      },
      role: lambdaRole
    });

    // -------------------------------------------------------------------------
    // 5. API Gateway
    // -------------------------------------------------------------------------
    const api = new apigateway.RestApi(this, 'FijianRagApi', {
      restApiName: 'FijianLanguageService',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'GET', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Amz-Date'],
        allowCredentials: true
      }
    });

    const endpoints = ['translate', 'verify', 'similar'];
    endpoints.forEach(path => {
      api.root.addResource(path).addMethod('POST', new apigateway.LambdaIntegration(fijianLambda));
    });

    const learnResource = api.root.addResource('learn');
    learnResource.addMethod('GET', new apigateway.LambdaIntegration(fijianLambda));
    learnResource.addMethod('POST', new apigateway.LambdaIntegration(fijianLambda));

    const moduleResource = api.root.addResource('module');
    moduleResource.addMethod('GET', new apigateway.LambdaIntegration(fijianLambda));

    const verifyModuleResource = api.root.addResource('verify-module');
    verifyModuleResource.addMethod('POST', new apigateway.LambdaIntegration(fijianLambda));

    // Separate API for textract aggregation
    const textractApi = new apigateway.RestApi(this, 'TextractAggregatorAPI', {
      restApiName: 'TextractAggregatorAPI',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET'],
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS
      }
    });

    textractApi.root.addResource('aggregate').addMethod('GET', new apigateway.LambdaIntegration(textractAggregatorFn));
  }
}