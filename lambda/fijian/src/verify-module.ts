// lambda/verify-module.ts
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

const ddb = new DynamoDBClient({ region: 'us-west-2' });
const TABLE_NAME = process.env.TRANSLATIONS_TABLE!;

export const handler: APIGatewayProxyHandler = async (event) => {
  if (!event.body) {
    return { statusCode: 400, body: 'Missing request body' };
  }

  try {
    const data = JSON.parse(event.body);
    const id = uuidv4();

    const item = {
      id: { S: id },
      type: { S: 'module' },
      source: { S: 'Fijian Reference Grammar' },
      verified: { BOOL: true },
      learningModuleTitle: { S: data.title },
      createdAt: { S: new Date().toISOString() },
      fullText: { S: data.fullText || '' },
      rawJson: { S: JSON.stringify(data.modules) },
    };

    await ddb.send(new PutItemCommand({ TableName: TABLE_NAME, Item: item }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Module verified and saved.' })
    };
  } catch (err) {
    console.error('Error saving module:', err);
    return { statusCode: 500, body: 'Internal server error' };
  }
};