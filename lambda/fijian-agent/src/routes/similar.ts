import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { buildResponse, generateEmbedding } from './utils';

const ddb = new DynamoDBClient({ region: 'us-west-2' });
const TABLE_NAME = process.env.TRANSLATIONS_TABLE!;

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { sourceText } = JSON.parse(event.body || '{}');
    if (!sourceText) return buildResponse(400, { message: 'Missing sourceText' });

    const queryEmbedding = await generateEmbedding(sourceText);

    const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
    const candidates = (result.Items || []).filter(item => item.type?.S === 'translation' && item.embedding?.S);

    const scored = candidates
    .map(item => {
      let embedding: number[] = [];
      try {
        embedding = JSON.parse(item.embedding?.S || '[]');
      } catch {
        return null;
      }
  
      const score = cosineSimilarity(queryEmbedding, embedding);
      return {
        id: item.id?.S,
        sourceText: item.sourceText?.S,
        translatedText: item.translatedText?.S,
        score
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.score - a.score)

    return buildResponse(200, { similar: scored.slice(0, 5) });
  } catch (err) {
    console.error('Similar error:', err);
    return buildResponse(500, { message: 'Failed to retrieve similar items' });
  }
};