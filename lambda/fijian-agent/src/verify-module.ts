import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const ddb = new DynamoDBClient({ region: 'us-west-2' });
const TABLE_NAME = process.env.TRANSLATIONS_TABLE!;

export const handler: APIGatewayProxyHandler = async (event) => {
  if (!event.body) {
    return { statusCode: 400, body: 'Missing request body' };
  }

  try {
    const data = JSON.parse(event.body);
    const now = new Date().toISOString();

    if (data.id) {
      // ✅ Update existing item
      const command = new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { id: { S: data.id } },
        UpdateExpression: "SET verified = :v, rawJson = :r, fullText = :t, updatedAt = :u",
        ExpressionAttributeValues: {
          ":v": { BOOL: true },
          ":r": { S: JSON.stringify(data.modules) },
          ":t": { S: data.fullText || '' },
          ":u": { S: now }
        }
      });

      await ddb.send(command);
    } else {
      // ✅ Create new item
      const id = uuidv4();

      const item = {
        id: { S: id },
        type: { S: 'module' },
        source: { S: 'Fijian Reference Grammar' },
        verified: { BOOL: true },
        learningModuleTitle: { S: data.title },
        createdAt: { S: now },
        fullText: { S: data.fullText || '' },
        rawJson: { S: JSON.stringify(data.modules) },
      };

      await ddb.send(new PutItemCommand({ TableName: TABLE_NAME, Item: item }));
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Module verified and saved.' })
    };

  } catch (err) {
    console.error('❌ Error verifying module:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: 'Internal server error'
    };
  }
};