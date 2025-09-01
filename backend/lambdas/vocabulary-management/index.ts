/**
 * Vocabulary Management Lambda Function
 * 
 * Provides APIs for native speakers to manage vocabulary definitions:
 * - List vocabulary records with filtering and sorting
 * - Update definitions for vocabulary entries
 * - Get AI-suggested definitions (optional)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, ScanCommand, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const ddbClient = new DynamoDBClient({});
const bedrockClient = new BedrockRuntimeClient({ region: 'us-west-2' });

interface VocabularyRecord {
  word: string;
  frequency: number;
  sources: string[];
  lastSeen: string;
  definition?: string;
  context?: string;
  articleIds?: string[];
}

interface VocabularyListResponse {
  items: VocabularyRecord[];
  total: number;
  hasMore: boolean;
  lastEvaluatedKey?: any;
}

interface SuggestDefinitionRequest {
  word: string;
  context?: string;
}

interface UpdateDefinitionRequest {
  definition: string;
  context?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Vocabulary Management Event:', JSON.stringify(event, null, 2));

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Content-Type': 'application/json'
  };

  try {
    const { httpMethod, path, queryStringParameters, pathParameters, body } = event;

    // Handle CORS preflight
    if (httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
    }

    switch (httpMethod) {
      case 'GET':
        if (path.includes('/vocabulary/management')) {
          return await handleListVocabulary(queryStringParameters || {}, headers);
        }
        break;

      case 'PUT':
        if (path.includes('/vocabulary/') && path.includes('/definition')) {
          const word = pathParameters?.word;
          if (!word) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Word parameter required' })
            };
          }
          return await handleUpdateDefinition(word, body, headers);
        }
        break;

      case 'POST':
        if (path.includes('/vocabulary/suggest-definition')) {
          return await handleSuggestDefinition(body, headers);
        }
        break;

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (error) {
    console.error('Error in vocabulary management:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * List vocabulary records with filtering and sorting
 */
async function handleListVocabulary(
  queryParams: Record<string, string>,
  headers: Record<string, string>
): Promise<APIGatewayProxyResult> {
  try {
    const {
      limit = '50',
      lastEvaluatedKey,
      hasDefinition,
      sortBy = 'frequency', // frequency, word, lastSeen
      sortOrder = 'desc' // asc, desc
    } = queryParams;

    const scanParams: any = {
      TableName: process.env.VOCABULARY_FREQUENCY_TABLE!,
      Limit: parseInt(limit),
    };

    if (lastEvaluatedKey) {
      scanParams.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastEvaluatedKey));
    }

    // Add filter expression for hasDefinition
    if (hasDefinition !== undefined) {
      if (hasDefinition === 'true') {
        scanParams.FilterExpression = 'attribute_exists(definition) AND definition <> :empty';
        scanParams.ExpressionAttributeValues = marshall({ ':empty': '' });
      } else if (hasDefinition === 'false') {
        scanParams.FilterExpression = 'attribute_not_exists(definition) OR definition = :empty';
        scanParams.ExpressionAttributeValues = marshall({ ':empty': '' });
      }
    }

    const result = await ddbClient.send(new ScanCommand(scanParams));
    
    const items = (result.Items || [])
      .map(item => unmarshall(item) as VocabularyRecord)
      .sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'frequency':
            comparison = a.frequency - b.frequency;
            break;
          case 'word':
            comparison = a.word.localeCompare(b.word);
            break;
          case 'lastSeen':
            comparison = new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime();
            break;
          default:
            comparison = a.frequency - b.frequency;
        }
        
        return sortOrder === 'desc' ? -comparison : comparison;
      });

    const response: VocabularyListResponse = {
      items,
      total: result.Count || 0,
      hasMore: !!result.LastEvaluatedKey,
      ...(result.LastEvaluatedKey && { 
        lastEvaluatedKey: encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) 
      })
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Error listing vocabulary:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to list vocabulary',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

/**
 * Update definition for a vocabulary entry
 */
async function handleUpdateDefinition(
  word: string,
  body: string | null,
  headers: Record<string, string>
): Promise<APIGatewayProxyResult> {
  try {
    if (!body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body required' })
      };
    }

    const request: UpdateDefinitionRequest = JSON.parse(body);
    
    if (!request.definition) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Definition is required' })
      };
    }

    // First check if the word exists
    const getResult = await ddbClient.send(new GetItemCommand({
      TableName: process.env.VOCABULARY_FREQUENCY_TABLE!,
      Key: marshall({ word: decodeURIComponent(word) })
    }));

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Word not found' })
      };
    }

    // Update the definition
    const updateParams: any = {
      TableName: process.env.VOCABULARY_FREQUENCY_TABLE!,
      Key: marshall({ word: decodeURIComponent(word) }),
      UpdateExpression: 'SET definition = :def, lastUpdated = :lastUpdated',
      ExpressionAttributeValues: marshall({
        ':def': request.definition,
        ':lastUpdated': new Date().toISOString()
      }),
      ReturnValues: 'ALL_NEW'
    };

    if (request.context) {
      updateParams.UpdateExpression += ', context = :ctx';
      updateParams.ExpressionAttributeValues = marshall({
        ...unmarshall(updateParams.ExpressionAttributeValues),
        ':ctx': request.context
      });
    }

    const result = await ddbClient.send(new UpdateItemCommand(updateParams));
    
    const updatedRecord = result.Attributes ? unmarshall(result.Attributes) : null;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Definition updated successfully',
        record: updatedRecord
      })
    };

  } catch (error) {
    console.error('Error updating definition:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to update definition',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

/**
 * Get AI-suggested definition for a word
 */
async function handleSuggestDefinition(
  body: string | null,
  headers: Record<string, string>
): Promise<APIGatewayProxyResult> {
  try {
    if (!body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body required' })
      };
    }

    const request: SuggestDefinitionRequest = JSON.parse(body);
    
    if (!request.word) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Word is required' })
      };
    }

    const prompt = `Please provide a clear, concise English definition for the Fijian word "${request.word}".${
      request.context ? ` Here is some context where it appears: "${request.context}"` : ''
    }

Requirements:
- Provide only the definition, no extra explanation
- Keep it under 100 words
- Focus on the most common meaning
- If it's a proper noun, indicate that
- If uncertain, indicate that it's a suggested definition

Definition:`;

    const requestBody = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: prompt
      }]
    };

    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      body: JSON.stringify(requestBody),
      contentType: 'application/json'
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    const suggestedDefinition = responseBody.content[0].text.trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        word: request.word,
        suggestedDefinition,
        confidence: 'ai-suggested' // Indicate this is AI-generated
      })
    };

  } catch (error) {
    console.error('Error suggesting definition:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to suggest definition',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}