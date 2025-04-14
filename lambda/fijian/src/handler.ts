// lambda/fijian/src/handler.ts

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Types and Interfaces
interface TranslationRequest {
  sourceText: string;
  sourceLanguage: 'en' | 'fj';
  targetLanguage: 'en' | 'fj';
}

interface TranslationDebug {
  foundSimilarTranslations: Array<{
    id: string;
    sourceText: string;
    translatedText: string;
    verified: string;
    createdAt: string;
    similarity: number;
  }>;
}

interface Translation {
  id: string;
  sourceText: string;
  translation: string;
  sourceLanguage: string;
  sourceEmbedding: number[];
  translationEmbedding: number[];
  verified: string;
  createdAt: string;
  verificationDate?: string;
  verifier?: string;
  context?: string;
  category?: string;
  similarity?: number;
}

interface TranslateResponse {
  translatedText: string;
  rawResponse: string;
  confidence?: number;
  id: string;
  similarTranslations: number;
  debug?: TranslationDebug;
}

interface ClaudeResponse {
  translation: string;
  rawResponse: string;
  confidence?: number;
}

// Constants
const TABLE_NAME = process.env.TABLE_NAME || 'TranslationsTable';
const SIMILARITY_THRESHOLD = 0.85;

// Initialize AWS clients
const ddb = DynamoDBDocument.from(new DynamoDB());
const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });

// Helper functions
async function getEmbedding(text: string): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v1',
    contentType: 'application/json',
    body: JSON.stringify({
      inputText: text
    })
  });

  const response = await bedrock.send(command);
  const embedding = JSON.parse(new TextDecoder().decode(response.body)).embedding;
  return embedding;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

async function translateWithClaude(text: string, sourceLanguage: 'en' | 'fj'): Promise<ClaudeResponse> {
  const prompt = sourceLanguage === 'fj' 
    ? `Translate this Fijian text to English. Provide your response in JSON format with two fields:
       1. "translation" - containing only the direct translation
       2. "notes" - containing any explanatory notes, context, or alternative translations
       Input text: "${text}"`
    : `Translate this English text to Fijian. Provide your response in JSON format with two fields:
       1. "translation" - containing only the direct translation
       2. "notes" - containing any explanatory notes, context, or alternative translations
       Input text: "${text}"`;

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contentType: 'application/json',
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1
    })
  });

  const response = await bedrock.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  
  try {
    const rawText = result.content[0].text;
    let parsedResponse;
    
    try {
      // Try to parse the entire response as JSON
      parsedResponse = JSON.parse(rawText);
    } catch (e) {
      // If that fails, try to extract JSON from the text
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          console.warn('Failed to parse extracted JSON:', e2);
        }
      }
    }

    if (parsedResponse && parsedResponse.translation) {
      return {
        translation: parsedResponse.translation.trim(),
        rawResponse: rawText,
        confidence: result.confidence
      };
    }

    // Fallback: Try to extract translation from the raw text
    const translationMatch = rawText.match(/"translation"\s*:\s*"([^"]+)"/);
    if (translationMatch) {
      return {
        translation: translationMatch[1].trim(),
        rawResponse: rawText,
        confidence: result.confidence
      };
    }

    // Last resort: Use the entire text as translation
    console.warn('Using raw text as translation');
    return {
      translation: rawText.replace(/^.*?"|\n|"$/g, '').trim(),
      rawResponse: rawText,
      confidence: result.confidence
    };
  } catch (e) {
    console.error('Unexpected error processing Claude response:', e);
    throw e;
  }
}

async function findSimilarTranslations(
  sourceText: string,
  sourceLanguage: 'en' | 'fj',
  sourceEmbedding: number[]
): Promise<Translation[]> {
  const result = await ddb.query({
    TableName: TABLE_NAME,
    IndexName: 'SourceLanguageIndex',
    KeyConditionExpression: 'sourceLanguage = :sl',
    ExpressionAttributeValues: {
      ':sl': sourceLanguage
    }
  });

  if (!result.Items) return [];

  return result.Items
    .map(item => ({
      ...(item as Omit<Translation, 'similarity'>),
      similarity: cosineSimilarity(sourceEmbedding, (item as Translation).sourceEmbedding)
    }))
    .filter(item => item.similarity! >= SIMILARITY_THRESHOLD)
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
}

// Main handler
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (event.httpMethod !== 'POST' || !event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Missing request body or invalid method' })
      };
    }

    const parsedBody = JSON.parse(event.body);

    switch (event.path) {
      case '/translate': {
        const request = parsedBody as TranslationRequest;
        const sourceEmbedding = await getEmbedding(request.sourceText);
        
        // Check for similar translations
        const similarTranslations = await findSimilarTranslations(
          request.sourceText,
          request.sourceLanguage,
          sourceEmbedding
        );
        
        if (similarTranslations.length > 0) {
          const bestMatch = similarTranslations[0];
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
              translatedText: bestMatch.translation,
              confidence: bestMatch.similarity,
              id: bestMatch.id,
              similarTranslations: similarTranslations.length,
              debug: { foundSimilarTranslations: similarTranslations }
            })
          };
        }

        // If no similar translation found, use Claude
        const claudeResponse = await translateWithClaude(request.sourceText, request.sourceLanguage);
        const translationEmbedding = await getEmbedding(claudeResponse.translation);

        // Store the new translation
        const translation = {
          id: uuidv4(),
          sourceText: request.sourceText,
          translation: claudeResponse.translation,
          sourceLanguage: request.sourceLanguage,
          sourceEmbedding,
          translationEmbedding,
          verified: 'false',
          createdAt: new Date().toISOString()
        };

        await ddb.put({
          TableName: TABLE_NAME,
          Item: translation
        });

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            translatedText: claudeResponse.translation,
            rawResponse: claudeResponse.rawResponse,
            confidence: claudeResponse.confidence,
            id: translation.id,
            similarTranslations: 0
          })
        };
      }

      case '/verify': {
        const request = parsedBody;
        const updateResponse = await ddb.update({
          TableName: TABLE_NAME,
          Key: { id: request.id },
          UpdateExpression: 'SET verified = :verified, verificationDate = :date, #translation = :translation',
          ExpressionAttributeNames: {
            '#translation': 'translation'
          },
          ExpressionAttributeValues: {
            ':verified': request.verified.toString(),
            ':date': new Date().toISOString(),
            ':translation': request.translatedText
          },
          ReturnValues: 'ALL_NEW'
        });

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(updateResponse.Attributes)
        };
      }

      default:
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ message: 'Not found' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
}