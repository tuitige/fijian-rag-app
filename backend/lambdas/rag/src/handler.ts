/**
 * Fijian RAG App - RAG Query and Dictionary Operations Handler
 * 
 * This Lambda function handles:
 * 1. POST /rag/query - Processes RAG queries using Claude Sonnet 3.5 v2 and OpenSearch
 * 2. GET /dictionary/lookup - Dictionary word lookups
 * 3. GET /dictionary/search - Dictionary search with full-text and semantic search
 * 
 * Key features:
 * - RAG pipeline with vector search and LLM generation
 * - Dictionary operations with both exact and fuzzy matching
 * - OpenSearch integration for semantic search
 * - Comprehensive error handling and logging
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, QueryCommand, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { 
  retrieveRagContext, 
  lookupWordExact,
  searchDictionarySemantic,
  formatDictionaryContext,
  RagContextOptions 
} from './rag-service';

// Configuration constants
const CLAUDE_MODEL_ID = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
const MAX_TOKENS = 1000;
const ANTHROPIC_VERSION = 'bedrock-2023-05-31';

// Environment variables
const DICTIONARY_TABLE = process.env.DICTIONARY_TABLE!;
const USER_PROGRESS_TABLE = process.env.USER_PROGRESS_TABLE!;
const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT!;

const ddbClient = new DynamoDBClient({});
const bedrockClient = new BedrockRuntimeClient({});

/**
 * Creates a standardized JSON response with CORS headers
 */
function jsonResponse(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  };
}

/**
 * Validates user input for RAG queries
 */
function validateRagInput(input: string): boolean {
  return input && input.trim().length > 0 && input.length <= 1000;
}

/**
 * Looks up a word in the dictionary table (using shared service)
 */
async function lookupWord(word: string, language: string = 'fijian'): Promise<any> {
  return await lookupWordExact(word, language);
}

/**
 * Searches dictionary using OpenSearch (using shared service)
 */
async function searchDictionary(query: string, limit: number = 10): Promise<any[]> {
  return await searchDictionarySemantic(query, limit);
}

/**
 * Generates RAG response using retrieved context and Claude (updated to use shared formatting)
 */
async function generateRagResponse(query: string, context: any[]): Promise<string> {
  try {
    const contextText = formatDictionaryContext(context);

    const prompt = `You are a helpful Fijian language learning assistant. Use the following dictionary entries and language context to answer the user's question about Fijian language.

Context:
${contextText}

User Question: ${query}

Please provide a helpful, accurate response that incorporates the relevant information from the context. If the context doesn't contain enough information to fully answer the question, say so and provide what information you can.`;

    const payload = {
      anthropic_version: ANTHROPIC_VERSION,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    const command = new InvokeModelCommand({
      modelId: CLAUDE_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    return responseBody.content?.[0]?.text || 'I apologize, but I was unable to generate a response at this time.';
  } catch (error) {
    console.error('Error generating RAG response:', error);
    return 'I apologize, but I encountered an error while generating a response.';
  }
}

/**
 * Records user interaction for progress tracking
 */
async function recordUserProgress(userId: string, action: string, data: any): Promise<void> {
  try {
    const timestamp = Date.now();
    const params = {
      TableName: USER_PROGRESS_TABLE,
      Item: marshall({
        userId,
        timestamp,
        action,
        data,
        createdAt: new Date().toISOString()
      })
    };

    await ddbClient.send(new PutItemCommand(params));
  } catch (error) {
    console.error('Error recording user progress:', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Main Lambda handler
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('[handler] Received event:', JSON.stringify(event, null, 2));
  console.log('[handler] HTTP Method:', event.httpMethod);
  console.log('[handler] Path:', event.path);

  try {
    // Handle dictionary lookup: GET /dictionary/lookup?word=bula&language=fijian
    if (event.httpMethod === 'GET' && event.path === '/dictionary/lookup') {
      const word = event.queryStringParameters?.word;
      const language = event.queryStringParameters?.language || 'fijian';

      if (!word) {
        return jsonResponse(400, { error: 'Missing required parameter: word' });
      }

      console.log(`[handler] Looking up word: ${word} in language: ${language}`);
      
      const result = await lookupWord(word, language);
      
      if (!result) {
        return jsonResponse(404, { error: 'Word not found', word, language });
      }

      return jsonResponse(200, { word: result });
    }

    // Handle dictionary search: GET /dictionary/search?q=greeting&limit=10
    if (event.httpMethod === 'GET' && event.path === '/dictionary/search') {
      const query = event.queryStringParameters?.q;
      const limit = parseInt(event.queryStringParameters?.limit || '10');

      if (!query) {
        return jsonResponse(400, { error: 'Missing required parameter: q' });
      }

      console.log(`[handler] Searching dictionary for: ${query}`);
      
      const results = await searchDictionary(query, limit);
      
      return jsonResponse(200, { 
        query, 
        results,
        total: results.length 
      });
    }

    // Handle RAG query: POST /rag/query
    if (event.httpMethod === 'POST' && event.path === '/rag/query') {
      const body = JSON.parse(event.body || '{}');
      const { query, userId } = body;

      if (!query || !validateRagInput(query)) {
        return jsonResponse(400, { 
          error: 'Invalid or missing query. Query must be 1-1000 characters.' 
        });
      }

      console.log(`[handler] Processing RAG query: ${query}`);

      // Use shared RAG service for context retrieval
      const ragOptions: RagContextOptions = {
        maxEntries: 5,
        minScore: 0.1,
        includeExactLookup: true,
        includeSemanticSearch: true
      };
      
      const ragContextResult = await retrieveRagContext(query, ragOptions);
      
      // Generate response using existing RAG pipeline
      const response = await generateRagResponse(query, ragContextResult.entries);

      // Record user interaction if userId provided
      if (userId) {
        await recordUserProgress(userId, 'rag_query', {
          query,
          contextUsed: ragContextResult.entries.length,
          response: response.substring(0, 100) + '...' // Store first 100 chars
        });
      }

      return jsonResponse(200, {
        query,
        response,
        contextUsed: ragContextResult.entries.length,
        sources: ragContextResult.sourcesSummary
      });
    }

    // Handle unsupported routes
    return jsonResponse(404, { 
      error: 'Not Found', 
      message: `Route ${event.httpMethod} ${event.path} not found` 
    });

  } catch (error: any) {
    console.error('[handler] Error processing request:', error);
    
    return jsonResponse(500, {
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while processing your request.'
    });
  }
};