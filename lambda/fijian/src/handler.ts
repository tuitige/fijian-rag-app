// lambda/fijian/src/handler.ts

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Types and Interfaces
interface TranslationRequest {
  sourceText: string;
  sourceLanguage: 'en' | 'fj';
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
  verificationDate: string;
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
    const parsedResponse = JSON.parse(result.content[0].text);
    return {
      translation: parsedResponse.translation.trim(),
      rawResponse: result.content[0].text,
      confidence: result.confidence
    };
  } catch (e) {
    console.warn('Failed to parse Claude response as JSON:', e);
    const rawText = result.content[0].text;
    return {
      translation: rawText.replace(/^.*?"|"\n|"$/g, '').trim(),
      rawResponse: rawText,
      confidence: result.confidence
    };
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
    const { path, body } = event;
    if (!body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Missing request body' })
      };
    }

    const parsedBody = JSON.parse(body);

    switch (path) {
      case '/translate': {
        const { sourceText, sourceLanguage } = parsedBody as TranslationRequest;

        if (!sourceText || !sourceLanguage) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Missing required fields' })
          };
        }

        const sourceEmbedding = await getEmbedding(sourceText);
        const similarTranslations = await findSimilarTranslations(sourceText, sourceLanguage, sourceEmbedding);
        
        let translatedText: string;
        let rawResponse: string;
        let confidence: number | undefined;

        const verifiedTranslation = similarTranslations.find(t => t.verified === 'true');
        
        if (verifiedTranslation && verifiedTranslation.similarity !== undefined) {
          translatedText = verifiedTranslation.translation;
          rawResponse = JSON.stringify({
            translation: verifiedTranslation.translation,
            notes: `Using verified translation (similarity: ${verifiedTranslation.similarity.toFixed(3)})`
          });
          confidence = 1.0;
        } else {
          const claudeResponse = await translateWithClaude(sourceText, sourceLanguage);
          translatedText = claudeResponse.translation;
          rawResponse = claudeResponse.rawResponse;
          confidence = claudeResponse.confidence;
        }

        const translationEmbedding = await getEmbedding(translatedText);
        const id = uuidv4();
        const currentDate = new Date().toISOString();

        const newTranslation: Translation = {
          id,
          sourceText,
          translation: translatedText,
          sourceLanguage,
          sourceEmbedding,
          translationEmbedding,
          verified: 'false',
          createdAt: currentDate,
          verificationDate: currentDate
        };

        await ddb.put({
          TableName: TABLE_NAME,
          Item: newTranslation
        });

        const response: TranslateResponse = {
          translatedText,
          rawResponse,
          confidence,
          id,
          similarTranslations: similarTranslations.length,
          debug: {
            foundSimilarTranslations: similarTranslations.map(t => ({
              id: t.id,
              sourceText: t.sourceText,
              translatedText: t.translation,
              verified: t.verified,
              createdAt: t.createdAt,
              similarity: t.similarity ?? 0
            }))
          }
        };

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(response)
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
