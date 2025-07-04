import { handler } from '../lambda/fijian/src/handler';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDB: jest.fn(),
  DynamoDBClient: jest.fn(),
  QueryCommand: jest.fn(),
  ScanCommand: jest.fn()
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocument: {
    from: jest.fn().mockReturnValue({
      scan: jest.fn().mockImplementation(() => Promise.resolve({
        Items: [
          {
            id: '1',
            learningModuleTitle: 'Basic Greetings',
            pageNumber: 1,
            content: 'Bula! This is the most common greeting in Fijian.'
          },
          {
            id: '2',
            learningModuleTitle: 'Basic Greetings',
            pageNumber: 2,
            content: 'Ni sa bula is a more formal greeting used in Fijian.'
          },
          {
            id: '3',
            learningModuleTitle: 'Numbers',
            pageNumber: 1,
            content: 'Learning to count in Fijian: dua (1), rua (2), tolu (3)'
          }
        ]
      }))
    })
  }
}));

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockReturnValue({
    send: jest.fn().mockImplementation(() => Promise.resolve({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'This is a test response from Claude.' }],
        usage: { input_tokens: 10, output_tokens: 15 }
      })),
      $metadata: { httpStatusCode: 200 }
    }))
  }),
  InvokeModelCommand: jest.fn()
}));

describe('Lambda Handler Tests', () => {
  describe('/learn endpoint', () => {
    it('should return learning modules with summaries', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/learn'
      } as APIGatewayProxyEvent;

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.modules).toBeDefined();
      expect(body.modules.length).toBe(2); // Two unique module titles
      expect(body.modules[0].title).toBe('Basic Greetings');
      expect(body.modules[0].pages).toBe(2);
      expect(body.modules[0].summary).toBeDefined();
      expect(body.modules[1].title).toBe('Numbers');
      expect(body.modules[1].pages).toBe(1);
      expect(body.modules[1].summary).toBeDefined();
    });

    it('should return 405 for non-GET requests', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/learn',
        body: '{}'
      } as APIGatewayProxyEvent;

      const response = await handler(event);
      expect(response.statusCode).toBe(405);
    });
  });

  describe('/chat endpoint', () => {
    it('should process chat messages successfully', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/chat',
        body: JSON.stringify({ input: 'Hello, how are you?' })
      } as APIGatewayProxyEvent;

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.response).toBe('This is a test response from Claude.');
      expect(body.model).toBe('anthropic.claude-3-haiku-20240307-v1:0');
      expect(body.inputTokens).toBe(10);
      expect(body.outputTokens).toBe(15);
    });

    it('should return 400 for empty input', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/chat',
        body: JSON.stringify({ input: '' })
      } as APIGatewayProxyEvent;

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('User input is required');
    });

    it('should return 400 for missing input', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/chat',
        body: JSON.stringify({})
      } as APIGatewayProxyEvent;

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('User input is required');
    });

    it('should handle invalid JSON body', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/chat',
        body: 'invalid json'
      } as APIGatewayProxyEvent;

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(body.error).toBe('Internal server error');
    });
  });
});