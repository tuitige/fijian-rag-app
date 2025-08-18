/**
 * Fijian RAG App - Chat and Learning Module Handler
 * 
 * This Lambda function handles:
 * 1. GET /learn - Returns available learning modules
 * 2. POST /chat - Processes chat messages using Claude 3 Haiku via AWS Bedrock
 * 
 * Key features:
 * - Comprehensive error handling and logging
 * - Proper AWS Bedrock model integration
 * - CORS support for web applications
 * - Request/response validation
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, QueryCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

// Configuration constants
const CLAUDE_MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0';
const MAX_TOKENS = 100;
const ANTHROPIC_VERSION = 'bedrock-2023-05-31';

// Environment variables for chat history
const USER_PROGRESS_TABLE = process.env.USER_PROGRESS_TABLE || '';

const ddbClient = new DynamoDBClient({});

/**
 * Creates a standardized JSON response with CORS headers
 * @param statusCode - HTTP status code
 * @param body - Response body (will be JSON stringified if not already a string)
 * @returns APIGatewayProxyResult with proper headers
 */
function jsonResponse(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  };
}

/**
 * Validates the input from the user
 * @param input - The user input string
 * @returns true if input is valid, false otherwise
 */
function validateUserInput(input: string): boolean {
  return typeof input === 'string' && input.trim().length > 0;
}

/**
 * Extracts the response text from Claude's response format
 * @param response - The parsed response from Claude
 * @returns The extracted text or a fallback message
 */
function extractResponseText(response: any): string {
  if (response.content && Array.isArray(response.content) && response.content.length > 0) {
    const firstContent = response.content[0];
    if (firstContent && typeof firstContent.text === 'string') {
      return firstContent.text;
    }
  }
  
  console.warn('[handler] Unexpected response format:', response);
  return 'Sorry, I received an unexpected response format.';
}

/**
 * Creates the request payload for Claude model via AWS Bedrock
 * @param userInput - The user's input message
 * @param maxTokens - Maximum tokens to generate (default: MAX_TOKENS)
 * @returns The formatted request payload
 */
function createClaudeRequestPayload(userInput: string, maxTokens: number = MAX_TOKENS) {
  return {
    anthropic_version: ANTHROPIC_VERSION,
    max_tokens: maxTokens,
    messages: [
      {
        role: "user",
        content: userInput
      }
    ]
  };
}

/**
 * Records a chat message to user progress table
 */
async function recordChatMessage(userId: string, message: string, response: string): Promise<void> {
  if (!USER_PROGRESS_TABLE || !userId) {
    return; // Skip if no table configured or no user ID
  }
  
  try {
    const timestamp = Date.now();
    const params = {
      TableName: USER_PROGRESS_TABLE,
      Item: marshall({
        userId,
        timestamp,
        action: 'chat_message',
        data: {
          message,
          response,
          createdAt: new Date().toISOString()
        }
      })
    };

    await ddbClient.send(new PutItemCommand(params));
  } catch (error) {
    console.error('Error recording chat message:', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Retrieves chat history for a user
 */
async function getChatHistory(userId: string, limit: number = 10): Promise<any[]> {
  if (!USER_PROGRESS_TABLE || !userId) {
    return [];
  }
  
  try {
    const params = {
      TableName: USER_PROGRESS_TABLE,
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: '#action = :action',
      ExpressionAttributeNames: {
        '#action': 'action'
      },
      ExpressionAttributeValues: marshall({
        ':userId': userId,
        ':action': 'chat_message'
      }),
      ScanIndexForward: false, // Latest first
      Limit: limit
    };

    const result = await ddbClient.send(new QueryCommand(params));
    
    if (!result.Items) {
      return [];
    }

    return result.Items.map(item => {
      const unmarshalled = unmarshall(item);
      return {
        timestamp: unmarshalled.timestamp,
        message: unmarshalled.data.message,
        response: unmarshalled.data.response,
        createdAt: unmarshalled.data.createdAt
      };
    }).reverse(); // Oldest first for display
  } catch (error) {
    console.error('Error retrieving chat history:', error);
    return [];
  }
}

/**
 * The AWS Lambda handler function
 * Handles both learning module queries and chat interactions
 */

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Log the incoming event for debugging
  console.log('[handler] Received event:', JSON.stringify(event, null, 2));
  console.log('[handler] HTTP Method:', event.httpMethod);
  console.log('[handler] Path:', event.path);

  try {
    if (event.httpMethod === 'GET' && event.path === '/learn') {
      console.log('[handler] Handling GET /learn request');
      const modules = [
        { title: 'Basic Greetings', pages: 2, summary: 'This is a summary of the module content.' },
        { title: 'Numbers', pages: 1, summary: 'This is a summary of the module content.' }
      ];
      return jsonResponse(200, { modules });
    }

    // Handle chat history: GET /chat/history?userId=user123&limit=10
    if (event.httpMethod === 'GET' && event.path === '/chat/history') {
      console.log('[handler] Handling GET /chat/history request');
      
      const userId = event.queryStringParameters?.userId;
      const limit = parseInt(event.queryStringParameters?.limit || '10');

      if (!userId) {
        return jsonResponse(400, { error: 'Missing required parameter: userId' });
      }

      console.log(`[handler] Retrieving chat history for user: ${userId}, limit: ${limit}`);
      
      const history = await getChatHistory(userId, limit);
      
      return jsonResponse(200, { 
        userId,
        history,
        total: history.length 
      });
    }

    if (event.httpMethod === 'POST' && event.path === '/chat') {
      console.log('[handler] Handling POST /chat request');
      
      // Parse and validate the request body
      const body = JSON.parse(event.body || '{}');
      console.log('[handler] Request body:', JSON.stringify(body, null, 2));
      
      const userInput = body.input || '';
      console.log('[handler] User input:', userInput);
      
      // Validate user input
      if (!validateUserInput(userInput)) {
        console.log('[handler] Invalid or empty user input detected');
        return jsonResponse(400, { error: 'User input is required' });
      }

      // Initialize Bedrock client
      const br = new BedrockRuntimeClient({});
      console.log('[handler] Bedrock client initialized');

      // Prepare the request payload for Claude model via Bedrock
      const requestPayload = createClaudeRequestPayload(userInput);
      console.log('[handler] Request payload:', JSON.stringify(requestPayload, null, 2));

      // Use the correct model ID for Claude 3 Haiku via Bedrock
      console.log('[handler] Using model ID:', CLAUDE_MODEL_ID);

      // Invoke the model
      const res = await br.send(new InvokeModelCommand({
        modelId: CLAUDE_MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestPayload)
      }));

      console.log('[handler] Bedrock response status:', res.$metadata.httpStatusCode);
      
      // Parse the response
      const responseBody = Buffer.from(res.body).toString();
      console.log('[handler] Raw response body:', responseBody);
      
      const parsedResponse = JSON.parse(responseBody);
      console.log('[handler] Parsed response:', JSON.stringify(parsedResponse, null, 2));
      
      // Extract the text content from Claude's response
      const responseText = extractResponseText(parsedResponse);
      console.log('[handler] Final response text:', responseText);
      
      // Record chat interaction if userId provided
      const userId = body.userId;
      if (userId) {
        await recordChatMessage(userId, userInput, responseText);
      }
      
      return jsonResponse(200, { 
        response: responseText,
        model: CLAUDE_MODEL_ID,
        inputTokens: parsedResponse.usage?.input_tokens || 0,
        outputTokens: parsedResponse.usage?.output_tokens || 0
      });
    }

    console.log('[handler] Unsupported method/path combination');
    return jsonResponse(405, { error: 'Method Not Allowed' });
    
  } catch (error) {
    // Enhanced error logging for debugging
    console.error('[handler] Error occurred:', error);
    
    // Type-safe error handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'Error';
    
    console.error('[handler] Error message:', errorMessage);
    if (errorStack) {
      console.error('[handler] Error stack:', errorStack);
    }
    
    // Log additional context for AWS SDK errors
    if (error && typeof error === 'object' && 'name' in error) {
      console.error('[handler] Error name:', errorName);
    }
    if (error && typeof error === 'object' && '$metadata' in error) {
      console.error('[handler] Error metadata:', JSON.stringify((error as any).$metadata, null, 2));
    }
    
    return jsonResponse(500, { 
      error: 'Internal server error',
      message: errorMessage,
      type: errorName
    });
  }
};
