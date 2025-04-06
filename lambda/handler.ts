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
  sourceEmbedding: number[];    // Embedding for source text
  translationEmbedding: number[]; // Embedding for translated text
  verified: string;
  createdAt: string;
  verifier?: string;
  verificationDate?: string;
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
    IndexName: 'VerifiedSourceLanguageIndex',
    KeyConditionExpression: 'verified = :v AND sourceLanguage = :sl',
    ExpressionAttributeValues: {
      ':v': 'true',
      ':sl': sourceLanguage
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
        const { text, sourceLanguage = 'fj' } = parsedBody as TranslationRequest;
        
        // First check for similar verified translations
        const similarTranslations = await findSimilarTranslations(text, sourceLanguage);
        
        if (similarTranslations.length > 0) {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              sourceText: similarTranslations[0].sourceText,
              translation: similarTranslations[0].translation,
              source: 'verified',
              sourceLanguage: similarTranslations[0].sourceLanguage
            })
          };
        }

        // Fall back to Claude for translation
        const translationResult = await translateWithClaude(text, sourceLanguage);

        // Get embeddings for both source and translation
        const [sourceEmbedding, translationEmbedding] = await Promise.all([
          getEmbedding(text),
          getEmbedding(translationResult.translation)
        ]);
        
        // Store unverified translation
        const newTranslation: Translation = {
          id: uuidv4(),
          sourceText: text,
          translation: translationResult.translation,
          sourceLanguage,
          sourceEmbedding,
          translationEmbedding,
          verified: 'false',
          createdAt: new Date().toISOString()
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
            sourceText: text,
            translation: translationResult.translation,
            rawResponse: translationResult.rawResponse,
            confidence: translationResult.confidence,
            source: 'claude',
            sourceLanguage
          })
        };
      }

      case '/verify': {
        const { text, verifiedEnglish } = parsedBody;
        const id = uuidv4(); // Using uuid v4 for unique IDs
        
        console.log('Verifying translation for:', text);
        console.log('Verified translation:', verifiedEnglish);
        
        // Get embeddings for both source and translation
        const [sourceEmbedding, translationEmbedding] = await Promise.all([
          getEmbedding(text),
          getEmbedding(verifiedEnglish)
        ]);
        
        await ddb.update({
          TableName: TABLE_NAME,
          Key: { id },
          ExpressionAttributeNames: {
            '#translation': 'translation',
            '#sourceText': 'sourceText',
            '#sourceEmbed': 'sourceEmbedding',
            '#translationEmbed': 'translationEmbedding'
          },
          UpdateExpression: 'set #sourceText = :s, #translation = :t, ' +
                          '#sourceEmbed = :se, #translationEmbed = :te, ' +
                          'verified = :v, verificationDate = :d',
          ExpressionAttributeValues: {
            ':s': text,
            ':t': verifiedEnglish,
            ':se': sourceEmbedding,
            ':te': translationEmbedding,
            ':v': 'true',
            ':d': new Date().toISOString()
          }
        });


        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: 'Translation verified successfully' })
        };
      }

      case '/learn': {
        const { sourceLanguage = 'fj', category } = parsedBody;
        
        const queryParams: any = {
          TableName: TABLE_NAME,
          IndexName: 'VerifiedIndex',
          KeyConditionExpression: 'verified = :v',
          ExpressionAttributeValues: {
            ':v': 'true',
            ':sl': sourceLanguage
          },
          FilterExpression: 'sourceLanguage = :sl'
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
