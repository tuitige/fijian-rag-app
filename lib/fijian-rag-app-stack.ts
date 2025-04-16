import { Stack, StackProps, Duration, RemovalPolicy, Fn } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
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
    
    // Allow future Bedrock agent interactions
    lambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'] // refine to specific model ARN in prod if needed
    }));
    
    lambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: ['*'] // or ClaudeModuleGeneratorLambda.functionArn
    }));

    lambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
      resources: [contentBucket.bucketArn, `${contentBucket.bucketArn}/*`]
    }));
    
    lambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['dynamodb:*'],
      resources: [translationsTable.tableArn]
    }));

    lambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: [
        'textract:StartDocumentAnalysis',
        'textract:GetDocumentAnalysis'
      ],
      resources: ['*'] // Or restrict to specific bucket
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
      timeout: Duration.minutes(3),
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
      timeout: Duration.minutes(3),
      role: lambdaRole
    });

    textractProcessor.addPermission('AllowS3Invoke', {
      principal: new iam.ServicePrincipal('s3.amazonaws.com'),
      sourceArn: contentBucket.bucketArn
    });

    contentBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(textractProcessor),
      { suffix: '.jpg' }
    );
    

    const textractAggregatorFn = new NodejsFunction(this, 'TextractAggregatorLambda', {
      entry: path.join(__dirname, '../lambda/textract-agent/src/textract-aggregator.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        BUCKET_NAME: contentBucket.bucketName
      },
      timeout: Duration.minutes(3),
      role: lambdaRole
    });

    const moduleGeneratorFn = new NodejsFunction(this, 'ClaudeModuleGeneratorLambda', {
      functionName: 'ClaudeModuleGeneratorLambda',
      entry: path.join(__dirname, '../lambda/textract-agent/src/claude-module-generator.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        TABLE_NAME: translationsTable.tableName,
        BUCKET_NAME: contentBucket.bucketName
      },
      timeout: Duration.minutes(3),
      role: lambdaRole
    });

/*    
    textractAggregatorFn.addEnvironment(
      'CLAUDE_MODULE_GENERATOR_FN',
      moduleGeneratorFn.functionName
    );
*/

/*
    lambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [moduleGeneratorFn.functionArn]
    }));
*/

    textractAggregatorFn.addEnvironment(
      'CLAUDE_MODULE_GENERATOR_FN',
      'ClaudeModuleGeneratorLambda'
    );

    lambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [
        `arn:aws:lambda:${this.region}:${this.account}:function:ClaudeModuleGeneratorLambda`
      ]
    }));


    contentBucket.grantReadWrite(moduleGeneratorFn);
    moduleGeneratorFn.addPermission('AllowS3Invoke', {
      principal: new iam.ServicePrincipal('s3.amazonaws.com'),
      sourceArn: contentBucket.bucketArn
    });

    const getPagesFn = new NodejsFunction(this, 'GetPagesLambda', {
      entry: path.join(__dirname, '../lambda/fijian-agent/src/routes/get-pages.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        BUCKET_NAME: contentBucket.bucketName
      },
      timeout: Duration.seconds(30),
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

    const getPagesResource = api.root.addResource('pages');
    getPagesResource.addMethod('GET', new apigateway.LambdaIntegration(getPagesFn), {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        }
      ]
    });
    

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