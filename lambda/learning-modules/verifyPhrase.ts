import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { generateEmbedding } from '../shared/bedrock/generateEmbedding';
import { indexTranslation } from '../shared/opensearch/indexOpenSearch';

export const handler = async (event) => {
  const { moduleId, phraseId, originalText, translatedText } = JSON.parse(event.body || '{}');
  const ddb = new DynamoDBClient({});

  await ddb.send(new UpdateItemCommand({
    TableName: process.env.DDB_LEARNING_MODULES_TABLE!,
    Key: {
      PK: { S: `module#${moduleId}` },
      SK: { S: `phrase#${phraseId}` }
    },
    UpdateExpression: 'SET verified = :v, translatedText = :t',
    ExpressionAttributeValues: {
      ':v': { S: 'true' },
      ':t': { S: translatedText }
    }
  }));

  const embedding = await generateEmbedding(originalText);

  await indexTranslation({
    originalText,
    translatedText,
    verified: true,
    source: 'VerifiedFromModule',
    moduleId,
    embedding,
    learningModuleTitle: ''
  });

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ message: 'Verified & stored in OpenSearch' })
  };
};
