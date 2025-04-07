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

interface Translation {
  id: string;
  sourceText: string;
  translation: string;
  sourceLanguage: 'en' | 'fj';
  sourceEmbedding: number[];
  translationEmbedding: number[];
  verified: string;
  createdAt: string;
  verificationDate: string;
  verifier?: string;
  context?: string;
  category?: string;
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
): Promise<Translation[]> {
  const queryEmbedding = await getEmbedding(text);
  
  const result = await ddb.query({
    TableName: TABLE_NAME,
    IndexName: 'SourceLanguageIndex', // New simplified index
    KeyConditionExpression: 'sourceLanguage = :sl',
    FilterExpression: 'verified = :v', // Move verified check to filter expression
    ExpressionAttributeValues: {
      ':sl': sourceLanguage,
      ':v': 'true'
    }
  });

  if (!result.Items) return [];

  const withSimilarity = result.Items.map(item => ({
    ...item,
    // Check similarity against both source and translation embeddings
    similarity: sourceLanguage === 'fj' 
      ? cosineSimilarity(queryEmbedding, item.sourceEmbedding)
      : cosineSimilarity(queryEmbedding, item.translationEmbedding)
  }));

  return withSimilarity
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .map(({ similarity, ...item }) => item as Translation);
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
      
        // Find similar translations from the database
        const similarTranslations = await findSimilarTranslations(sourceText, sourceLanguage);
      
        // Prepare context from similar translations
        let context = '';
        if (similarTranslations.length > 0) {
          context = similarTranslations
            .map(t => `${t.sourceText} = ${t.translation}`)
            .join('\n');
        }
      
        // Prepare the prompt based on source language
  // Prepare the prompt based on source language
  const targetLanguage = sourceLanguage === 'fj' ? 'English' : 'Fijian';
  const systemPrompt = `You are a helpful translator between Fijian and English languages.`;
  
  const humanPrompt = `Translate the following ${sourceLanguage === 'fj' ? 'Fijian' : 'English'} text to ${targetLanguage}. 
${context ? `\nHere are some similar translations for reference:\n${context}\n` : ''}
Text to translate: "${sourceText}"

Provide only the translation without any additional explanation.`;

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-v2',
    contentType: 'application/json',
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 2000,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: humanPrompt
        }
      ]
    })
  });

  const response = await bedrock.send(command);
  console.log('Bedrock response:', response);

  const result = JSON.parse(new TextDecoder().decode(response.body));
  const translation = result.content[0].text.trim();
  console.log('Translation result:', translation);    
        // Create new unverified translation record
        const id = uuidv4();
        const [sourceEmbedding, translationEmbedding] = await Promise.all([
          getEmbedding(sourceText),
          getEmbedding(translation)
        ]);
      
        const currentDate = new Date().toISOString();
        const newTranslation: Translation = {
          id,
          sourceText,
          translation,
          sourceLanguage,
          sourceEmbedding,
          translationEmbedding,
          verified: 'false',
          createdAt: currentDate,
          verificationDate: currentDate  // Added this field
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
            translation,
            id,
            similarTranslations: similarTranslations.length
          })
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
