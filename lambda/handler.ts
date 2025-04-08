// lambda/handler.ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Constants
export const TABLE_NAME = process.env.TABLE_NAME || 'TranslationsTable';

// Initialize AWS clients
const ddb = DynamoDBDocument.from(new DynamoDB());
const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });

interface TranslationRequest {
  text: string;
  sourceLanguage: 'en' | 'fj';  // 'en' for English, 'fj' for Fijian
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

interface TranslationItem {
  id: string;
  source_text: string;
  translated_text: string;
  source_language: string;
  raw_response: string;
  confidence?: number;
  verified?: boolean;
  embedding?: number[];
  created_at?: string;
  similar_translations?: number;
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
}

interface TranslateResponse {
  translatedText: string;
  rawResponse: string;
  confidence?: number;
  id: string;
  similarTranslations: number;
  debug?: TranslationDebug;
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

async function translateWithClaude(text: string, sourceLanguage: 'en' | 'fj'): Promise<{
  translation: string;
  rawResponse: string;
  confidence?: number;
}> {
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
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1
    })
  });

  const response = await bedrock.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  
  try {
    // Parse Claude's response as JSON
    const parsedResponse = JSON.parse(result.content[0].text);
    return {
      translation: parsedResponse.translation.trim(),
      rawResponse: result.content[0].text,
      confidence: result.confidence || undefined
    };
  } catch (e) {
    // Fallback if Claude doesn't return valid JSON
    console.warn('Failed to parse Claude response as JSON:', e);
    const rawText = result.content[0].text;
    return {
      translation: rawText.replace(/^.*?"|\n|"$/g, '').trim(),
      rawResponse: rawText,
      confidence: result.confidence || undefined
    };
  }
}

async function findSimilarTranslations(
  text: string, 
  sourceLanguage: 'en' | 'fj',
  threshold: number = 0.85
): Promise<{ translations: Translation[], similarities: number[] }> {
  const queryEmbedding = await getEmbedding(text);
  
  const result = await ddb.query({
    TableName: TABLE_NAME,
    IndexName: 'SourceLanguageIndex',
    KeyConditionExpression: 'sourceLanguage = :sl',
    ExpressionAttributeValues: {
      ':sl': sourceLanguage
    }
  });

  if (!result.Items) return { translations: [], similarities: [] };

  const withSimilarity = result.Items.map(item => ({
    translation: item as Translation,
    similarity: cosineSimilarity(queryEmbedding, item.sourceLanguage === sourceLanguage ? 
      item.sourceEmbedding : item.translationEmbedding)
  }));

  const filtered = withSimilarity
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);

  return {
    translations: filtered.map(item => item.translation),
    similarities: filtered.map(item => item.similarity)
  };
}

export async function main(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { path, body } = event;
    const parsedBody = JSON.parse(body || '{}');

    console.log('Received event:', event);
    console.log('Parsed body:', parsedBody);

    switch (path) {
      case '/translate': {
        const { sourceText, sourceLanguage } = parsedBody;
      
        // Validate required fields
        if (!sourceText || !sourceLanguage) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
              message: 'Missing required fields: sourceText and sourceLanguage are required' 
            })
          };
        }
      
        // Validate sourceLanguage is either 'en' or 'fj'
        if (!['en', 'fj'].includes(sourceLanguage)) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
              message: 'sourceLanguage must be either "en" or "fj"' 
            })
          };
        }
      
        // Get embeddings for similarity search
        // Get embeddings for similarity search
        const sourceEmbedding = await getEmbedding(sourceText);
        
        // Find similar translations
        const queryResult = await ddb.query({
          TableName: TABLE_NAME,
          IndexName: 'SourceLanguageIndex',
          KeyConditionExpression: 'sourceLanguage = :sl',
          ExpressionAttributeValues: {
            ':sl': sourceLanguage
          }
        });
      
        let similarTranslations = [];
        let translatedText: string;
        let rawResponse: string;
        let confidence: number | undefined;
        let useVerified = false;

        if (queryResult.Items) {
          // Calculate similarities and filter
          const SIMILARITY_THRESHOLD = 0.85;
          similarTranslations = queryResult.Items
            .map(item => ({
              ...item,
              similarity: cosineSimilarity(sourceEmbedding, item.sourceEmbedding)
            }))
            .filter(item => item.similarity >= SIMILARITY_THRESHOLD)
            .sort((a, b) => b.similarity - a.similarity);

          // Check for verified translation
          const verifiedTranslation = similarTranslations.find(item => item.verified === 'true');
          
          if (verifiedTranslation) {
            useVerified = true;
            translatedText = verifiedTranslation.translation;
            rawResponse = JSON.stringify({
              translation: verifiedTranslation.translation,
              notes: `Using verified translation (similarity: ${verifiedTranslation.similarity.toFixed(3)})`
            });
            confidence = 1.0;
          }
        }

        // Only call Claude if no verified translation was found
        if (!useVerified) {
          const claudeResponse = await translateWithClaude(sourceText, sourceLanguage);
          translatedText = claudeResponse.translation;
          rawResponse = claudeResponse.rawResponse;
          confidence = claudeResponse.confidence;
        }
      
        // Create embeddings for the new translation
        const translationEmbedding = await getEmbedding(translatedText);
      
        // Create new translation record
        const id = uuidv4();
        const currentDate = new Date().toISOString();
        
        const newTranslation: Translation = {
          id,
          sourceText,
          translation: translatedText,
          sourceLanguage,
          sourceEmbedding,
          translationEmbedding,
          verified: useVerified ? 'true' : 'false',
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
            foundSimilarTranslations: similarTranslations.map(item => ({
              id: item.id,
              sourceText: item.sourceText,
              translatedText: item.translation,
              verified: item.verified,
              createdAt: item.createdAt,
              similarity: item.similarity
            }))
          }
        };
      
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify(response)
        };
      }
    
      case '/verify': {
        const { sourceText, translatedText, sourceLanguage, verified = true } = parsedBody;
        
        // Validate required fields
        if (!sourceText || !translatedText || !sourceLanguage) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
              message: 'Missing required fields: sourceText, translatedText, and sourceLanguage are required' 
            })
          };
        }
      
        // Validate sourceLanguage is either 'en' or 'fj'
        if (!['en', 'fj'].includes(sourceLanguage)) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
              message: 'sourceLanguage must be either "en" or "fj"' 
            })
          };
        }
      
        const id = uuidv4();
        
        console.log('Verifying translation:', {
          sourceText,
          translatedText,
          sourceLanguage
        });
        
        // Get embeddings for both source and translation
        const [sourceEmbedding, translationEmbedding] = await Promise.all([
          getEmbedding(sourceText),
          getEmbedding(translatedText)
        ]);
        
        // Create new item with all required fields
        const newTranslation: Translation = {
          id,
          sourceText,
          translation: translatedText,
          sourceLanguage,
          sourceEmbedding,
          translationEmbedding,
          verified: 'true',
          createdAt: new Date().toISOString(),
          verificationDate: new Date().toISOString()
        };
      
        await ddb.put({
          TableName: TABLE_NAME,
          Item: newTranslation
        });
      
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            message: 'Translation verified successfully',
            id 
          })
        };
      }
      

      case '/learn': {
        const { sourceLanguage = 'fj', category } = parsedBody;
        
        const queryParams: any = {
          TableName: TABLE_NAME,
          IndexName: 'SourceLanguageIndex',
          KeyConditionExpression: 'sourceLanguage = :sl',
          ExpressionAttributeValues: {
            ':sl': sourceLanguage,
            ':v': 'true'            
          },
          FilterExpression: 'verified = :v'
        };

        if (category) {
          queryParams.FilterExpression += ' AND category = :c';
          queryParams.ExpressionAttributeValues[':c'] = category;
        }

        const result = await ddb.query(queryParams);

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify(result.Items)
        };
      }

      default:
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: 'Not found' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
}
