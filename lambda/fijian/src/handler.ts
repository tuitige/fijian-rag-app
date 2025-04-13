// lambda/fijian/src/handler.ts

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Types and Interfaces
interface ModuleSummary {
  title: string;
  description: string;
  totalPages: number;
  topics: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTimeMinutes: number;
  contentOverview: {
    vocabulary: number;
    grammar: number;
    conversations: number;
    exercises: number;
  };
  learningObjectives: string[];
  keyPhrases: {
    fijian: string;
    english: string;
    usage: string;
  }[];
  culturalNotes?: string[];
  prerequisites?: string[];
}

interface LearningModuleListResponse {
  modules: ModuleSummary[];
}

interface VerificationRequest {
  id: string; 
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

interface LearningModuleResponse {
  id: string;
  learningModuleTitle: string;
  content: string;
  pageNumber: number;
  paragraphs: string[];
  totalPages?: number;
}

// Constants
const TABLE_NAME = process.env.TABLE_NAME || 'TranslationsTable';
const LEARNING_TABLE_NAME = process.env.LEARNING_TABLE_NAME || 'LearningModulesTable';
const SIMILARITY_THRESHOLD = 0.85;

// Initialize AWS clients
const ddb = DynamoDBDocument.from(new DynamoDB());
const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

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
      translation: rawText.replace(/^.*?"|\n|"$/g, '').trim(),
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
    // Handle /learn endpoint separately since it supports GET
    if (event.path === '/learn') {
      if (event.httpMethod === 'GET') {
        if (event.queryStringParameters?.moduleTitle) {
          return await getLearningModule(
            event.queryStringParameters.moduleTitle,
            parseInt(event.queryStringParameters.page || '1')
          );
        } else {
          return await listLearningModules();
        }
      }
    }

    // All other endpoints require POST and body
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
        const request = parsedBody as VerificationRequest;
      
        if (!request.id) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Missing required field: id' })
          };
        }
      
        try {
          const updateResponse = await ddb.update({
            TableName: TABLE_NAME,
            Key: { id: { S: request.id } }, // Explicitly as DynamoDB string type
            UpdateExpression: 'SET verified = :verified, verificationDate = :date',
            ExpressionAttributeValues: {
              ':verified': { S: request.verified.toString() },
              ':date': { S: new Date().toISOString() }
            },
            ReturnValues: 'ALL_NEW'
          });
      
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(updateResponse.Attributes)
          };
        } catch (err) {
          console.error('Error updating item:', err);
          return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Failed to verify item', debug: err })
          };
        }
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

// Learning module functions
async function listLearningModules(): Promise<APIGatewayProxyResult> {
  try {
    const command = new ScanCommand({
      TableName: LEARNING_TABLE_NAME,
    });

    const response = await dynamoClient.send(command);
    const items = response.Items || [];

    // Group pages by module title
    const moduleGroups = items.reduce((acc, item) => {
      const title = item.learningModuleTitle?.S;
      if (title) {
        if (!acc[title]) {
          acc[title] = [];
        }
        acc[title].push(item);
      }
      return acc;
    }, {} as Record<string, any[]>);

    // Generate summaries for each module
    const moduleSummaries = await Promise.all(
      Object.entries(moduleGroups).map(async ([title, pages]) => {
        return await generateModuleSummary(title, pages);
      })
    );

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        modules: moduleSummaries
      })
    };
  } catch (error) {
    console.error('Error listing modules:', error);
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Error listing modules' })
    };
  }
}

async function generateModuleSummary(moduleTitle: string, pages: any[]): Promise<ModuleSummary> {
  const allContent = pages.map(page => page.content?.S || '').join('\n');
  
  const prompt = `Analyze this Fijian language learning module and provide a comprehensive summary. 
  Return your response in JSON format with the following fields:
  {
    "description": "A detailed 3-4 sentence overview of what this module covers",
    "topics": ["Array of specific topics covered"],
    "difficulty": "beginner/intermediate/advanced",
    "estimatedTimeMinutes": number,
    "contentOverview": {
      "vocabulary": number of vocabulary items,
      "grammar": number of grammar concepts,
      "conversations": number of conversation examples,
      "exercises": number of practice exercises
    },
    "learningObjectives": [
      "List of 3-5 specific learning objectives that clearly state what the student will be able to do after completing this module"
    ],
    "keyPhrases": [
      {
        "fijian": "Example phrase in Fijian",
        "english": "English translation",
        "usage": "Brief explanation of when/how to use this phrase"
      }
    ],
    "culturalNotes": [
      "2-3 relevant cultural context points that help understand the usage"
    ],
    "prerequisites": [
      "List any concepts or modules that should be completed first"
    ]
  }

  Module Title: "${moduleTitle}"
  Content: "${allContent.substring(0, 2000)}"

  Please ensure:
  1. Learning objectives are specific and measurable
  2. Key phrases are practical and commonly used
  3. Cultural notes provide relevant context
  4. Examples demonstrate practical usage`;

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contentType: 'application/json',
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1
    })
  });

  try {
    const response = await bedrock.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));
    const summary = JSON.parse(result.content[0].text);

    return {
      title: moduleTitle,
      description: summary.description,
      totalPages: pages.length,
      topics: summary.topics,
      difficulty: summary.difficulty,
      estimatedTimeMinutes: summary.estimatedTimeMinutes,
      contentOverview: summary.contentOverview,
      learningObjectives: summary.learningObjectives,
      keyPhrases: summary.keyPhrases,
      culturalNotes: summary.culturalNotes,
      prerequisites: summary.prerequisites
    };
  } catch (error) {
    console.error('Error generating module summary:', error);
    return {
      title: moduleTitle,
      description: "Summary generation failed",
      totalPages: pages.length,
      topics: [],
      difficulty: "beginner",
      estimatedTimeMinutes: 30,
      contentOverview: {
        vocabulary: 0,
        grammar: 0,
        conversations: 0,
        exercises: 0
      },
      learningObjectives: [],
      keyPhrases: [],
      culturalNotes: [],
      prerequisites: []
    };
  }
}

async function getLearningModule(moduleTitle: string, page: number): Promise<APIGatewayProxyResult> {
  try {
    const command = new QueryCommand({
      TableName: LEARNING_TABLE_NAME,
      IndexName: 'byLearningModule',
      KeyConditionExpression: 'learningModuleTitle = :title',
      ExpressionAttributeValues: {
        ':title': { S: moduleTitle }
      }
    });

    const response = await dynamoClient.send(command);
    const pages = response.Items || [];
    const currentPage = pages.find(p => parseInt(p.pageNumber?.N || '1') === page);
    
    if (!currentPage) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Page not found' })
      };
    }

    // Generate module summary
    const moduleSummary = await generateModuleSummary(moduleTitle, pages);

    const paragraphs = currentPage.paragraphs?.L
      ?.map(p => p.S)
      .filter((p): p is string => p !== undefined) || [];

    const moduleResponse = {
      id: currentPage.id?.S || '',
      learningModuleTitle: currentPage.learningModuleTitle?.S || '',
      content: currentPage.content?.S || '',
      pageNumber: parseInt(currentPage.pageNumber?.N || '1'),
      paragraphs,
      totalPages: pages.length,
      summary: moduleSummary  // Include the summary in the response
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(moduleResponse)
    };
  } catch (error) {
    console.error('Error getting module:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Error getting module' })
    };
  }
}
