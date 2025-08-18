import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as FijianRagApp from '../lib/fijian-rag-app-stack';

// Test to validate the new infrastructure components added for Issue #24
describe('Fijian RAG App Stack - Backend Infrastructure', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new FijianRagApp.FijianRagAppStack(app, 'TestStack');
    template = Template.fromStack(stack);
  });

  test('DynamoDB Dictionary Table Created', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        {
          AttributeName: 'word',
          AttributeType: 'S'
        },
        {
          AttributeName: 'language',
          AttributeType: 'S'
        }
      ],
      KeySchema: [
        {
          AttributeName: 'word',
          KeyType: 'HASH'
        },
        {
          AttributeName: 'language',
          KeyType: 'RANGE'
        }
      ]
    });
  });

  test('DynamoDB User Progress Table Created', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        {
          AttributeName: 'userId',
          AttributeType: 'S'
        },
        {
          AttributeName: 'timestamp',
          AttributeType: 'N'
        }
      ],
      KeySchema: [
        {
          AttributeName: 'userId',
          KeyType: 'HASH'
        },
        {
          AttributeName: 'timestamp',
          KeyType: 'RANGE'
        }
      ]
    });
  });

  test('OpenSearch Domain Created', () => {
    template.hasResourceProperties('AWS::OpenSearchService::Domain', {
      EngineVersion: 'OpenSearch_2.11'
    });
  });

  test('RAG Lambda Function Created', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs20.x',
      Handler: 'index.handler',
      MemorySize: 1024,
      Timeout: 120
    });
  });

  test('API Gateway Resources Created', () => {
    // Test for dictionary endpoints
    template.hasResource('AWS::ApiGateway::Resource', {});
    
    // Count the number of API Gateway resources to ensure all endpoints are created
    const resources = template.findResources('AWS::ApiGateway::Resource');
    const resourceCount = Object.keys(resources).length;
    
    // Should have resources for: root, learn, chat, chat/history, dictionary, dictionary/lookup, dictionary/search, rag, rag/query, learning-modules, learning-modules/{moduleId}, learning-modules/process
    expect(resourceCount).toBeGreaterThanOrEqual(8);
  });

  test('Lambda Permissions for Bedrock', () => {
    // Check that at least one IAM policy has Bedrock permissions
    const policies = template.findResources('AWS::IAM::Policy');
    
    let foundBedrockPermission = false;
    Object.values(policies).forEach((policy: any) => {
      const statements = policy.Properties.PolicyDocument.Statement;
      statements.forEach((statement: any) => {
        if (statement.Action === 'bedrock:InvokeModel' || 
            (Array.isArray(statement.Action) && statement.Action.includes('bedrock:InvokeModel'))) {
          foundBedrockPermission = true;
        }
      });
    });
    
    expect(foundBedrockPermission).toBe(true);
  });

  test('Lambda Permissions for OpenSearch', () => {
    // Check that at least one IAM policy has OpenSearch permissions
    const policies = template.findResources('AWS::IAM::Policy');
    
    let foundOpenSearchPermission = false;
    Object.values(policies).forEach((policy: any) => {
      const statements = policy.Properties.PolicyDocument.Statement;
      statements.forEach((statement: any) => {
        if (Array.isArray(statement.Action) && 
            statement.Action.some((action: string) => action.startsWith('es:ESHttp'))) {
          foundOpenSearchPermission = true;
        }
      });
    });
    
    expect(foundOpenSearchPermission).toBe(true);
  });
});
