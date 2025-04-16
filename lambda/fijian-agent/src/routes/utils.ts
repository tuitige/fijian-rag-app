import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, PutItemCommand, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });
const ddb = new DynamoDBClient({ region: 'us-west-2' });

export const buildResponse = (statusCode: number, data: any) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(data)
});

export const putItem = async (tableName: string, item: Record<string, any>) => {
  await ddb.send(new PutItemCommand({ TableName: tableName, Item: item }));
};

export const updateItem = async (tableName: string, id: string, updates: Record<string, any>) => {
  const updateExp = Object.keys(updates).map((k) => `#${k} = :${k}`).join(', ');
  const exprNames = Object.fromEntries(Object.keys(updates).map(k => [`#${k}`, k]));
  const exprVals = Object.fromEntries(Object.keys(updates).map(k => [`:${k}`, updates[k]]));

  await ddb.send(new UpdateItemCommand({
    TableName: tableName,
    Key: { id: { S: id } },
    UpdateExpression: `SET ${updateExp}`,
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: exprVals
  }));
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v1',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({ inputText: text })
  });

  const response = await bedrock.send(command);
  const body = JSON.parse(Buffer.from(response.body).toString('utf-8'));
  return body.embedding || [];
};

export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (magA * magB);
};

export const queryVerifiedTranslations = async (tableName: string, sourceLanguage: string) => {
  const result = await ddb.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'SourceLanguageIndex',
    KeyConditionExpression: 'sourceLanguage = :lang',
    FilterExpression: 'verified = :v',
    ExpressionAttributeValues: {
      ':lang': { S: sourceLanguage },
      ':v': { BOOL: true }
    }
  }));

  return result.Items || [];
};

export const translateWithClaude = async (text: string, sourceLanguage: 'en' | 'fj') => {
  const prompt = sourceLanguage === 'fj'
    ? `Translate this Fijian text to English. Provide your response in JSON format with two fields:\n1. \"translation\" - only the translated text\n2. \"notes\" - optional notes\n\nText: ${text}`
    : `Translate this English text to Fijian. Provide your response in JSON format with two fields:\n1. \"translation\" - only the translated text\n2. \"notes\" - optional notes\n\nText: ${text}`;

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contentType: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1000,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const response = await bedrock.send(command);
  console.log('translateWithClaude, Claude response:', response);
  const result = JSON.parse(Buffer.from(response.body).toString('utf-8'));
  console.log('translateWithClaude, parsed response:', result);
  const textBody = result.content?.[0]?.text || '';
  console.log('translateWithClaude, textBody:', textBody);

  try {
    const parsed = JSON.parse(textBody);
    return {
      translation: parsed.translation?.trim() || '',
      rawResponse: textBody,
      confidence: result.confidence || 1
    };
  } catch {
    return {
      translation: textBody,
      rawResponse: textBody,
      confidence: result.confidence || 1
    };
  }
};