// lambda/fijian/src/handler.ts

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Types and Interfaces
interface VerificationRequest {
  sourceText: string;
  translatedText: string;
  sourceLanguage: 'en' | 'fj';
  verified: boolean;
}

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

import { DynamoDBClient, QueryCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

interface LearningModuleResponse {
  id: string;
  learningModuleTitle: string;
  content: string;
  pageNumber: number;
  paragraphs: string[];
  totalPages?: number;
}

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
    const { path, httpMethod, body } = event;
    
    // Handle /learn endpoint separately since it supports both GET and POST
    if (path === '/learn') {
      if (httpMethod === 'GET') {
        if (event.queryStringParameters?.moduleTitle) {
          return await getLearningModule(
            event.queryStringParameters.moduleTitle,
            parseInt(event.queryStringParameters.page || '1')
          );
        } else {
          return await listLearningModules();
        }
      }
      // POST for /learn will be handled below with other POST endpoints
    }

    // All other endpoints require POST and body
    if (httpMethod !== 'POST' || !body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Missing request body or invalid method' })
      };
    }

    const parsedBody = JSON.parse(body);

    switch (path) {
      case '/translate': {
        // Existing translate code...
      }

      case '/verify': {
        // Existing verify code...
      }

      case '/learn': {
        // Handle POST for learning module progress/interaction
        return await handleLearningProgress(parsedBody);
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

// Add these new functions for learning module handling
async function listLearningModules(): Promise<APIGatewayProxyResult> {
  const command = new QueryCommand({
    TableName: process.env.TABLE_NAME,
    IndexName: 'byLearningModule',
    ProjectionExpression: 'learningModuleTitle, id',
    Select: 'SPECIFIC_ATTRIBUTES'
  });

  const response = await dynamoClient.send(command);
  
  // Get unique module titles
  const modules = [...new Set(response.Items?.map(item => item.learningModuleTitle.S))];

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ modules })
  };
}

async function getLearningModule(moduleTitle: string, page: number): Promise<APIGatewayProxyResult> {
  const command = new QueryCommand({
    TableName: process.env.LEARNING_TABLE_NAME,
    IndexName: 'byLearningModule',
    KeyConditionExpression: 'learningModuleTitle = :title',
    ExpressionAttributeValues: {
      ':title': { S: moduleTitle }
    }
  });

  const response = await dynamoClient.send(command);
  const pages = response.Items || [];
  const currentPage = pages.find(p => parseInt(p.pageNumber.N || '1') === page);
  
  if (!currentPage) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Page not found' })
    };
  }

  // Fix the TypeScript error by filtering out undefined values
  const paragraphs = currentPage.paragraphs.L
    ?.map(p => p.S)
    .filter((p): p is string => p !== undefined) || [];
    
  const moduleResponse: LearningModuleResponse = {
    id: currentPage.id.S || '',
    learningModuleTitle: currentPage.learningModuleTitle.S || '',
    content: currentPage.content.S || '',
    pageNumber: parseInt(currentPage.pageNumber.N || '1'),
    paragraphs,
    totalPages: pages.length
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(moduleResponse)
  };
}

async function handleLearningProgress(data: any): Promise<APIGatewayProxyResult> {
  // Implement progress tracking, scoring, etc.
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ message: 'Progress updated' })
  };
}