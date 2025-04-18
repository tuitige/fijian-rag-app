import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { BedrockVectorClient, SearchCommand } from '@aws-sdk/client-bedrock-vector'; // Hypothetical SDK if using native vector search, otherwise integrate OpenSearch
import { embedText } from './embed-text';

const ddb = new DynamoDBClient({ region: 'us-west-2' });
const VECTOR_INDEX = process.env.VECTOR_INDEX || 'fijian-embeddings';
const TABLE_NAME = process.env.TRANSLATIONS_TABLE || 'TranslationsTable';

export const queryVerifiedTranslation = async (sourceText: string) => {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'verifiedIndex',
    KeyConditionExpression: 'sourceText = :s and verified = :v',
    ExpressionAttributeValues: {
      ':s': { S: sourceText },
      ':v': { BOOL: true }
    }
  });

  const result = await ddb.send(command);
  if (result.Items && result.Items.length > 0) {
    const item = result.Items[0];
    return {
      id: item.id.S,
      translatedText: item.translatedText?.S || '',
      notes: item.notes?.S || ''
    };
  }

  return null;
};

export const querySimilarEmbeddings = async (text: string) => {
  const vector = await embedText(text);

  // Simulate vector search - replace with OpenSearch query or actual Bedrock Vector call
  const client = new BedrockVectorClient({ region: 'us-west-2' });
  const response = await client.send(new SearchCommand({
    indexId: VECTOR_INDEX,
    vector,
    topK: 3
  }));

  return response.matches || [];
};