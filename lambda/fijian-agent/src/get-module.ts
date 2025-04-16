import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyHandler } from 'aws-lambda';

const ddb = new DynamoDBClient({ region: 'us-west-2' });
const TABLE_NAME = process.env.TRANSLATIONS_TABLE!;

export const handler: APIGatewayProxyHandler = async (event) => {
  const title = event.queryStringParameters?.title;
  if (!title) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing module title' })
    };
  }

  const result = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'byLearningModule',
    KeyConditionExpression: 'learningModuleTitle = :t',
    ExpressionAttributeValues: {
      ':t': { S: title }
    },
    ScanIndexForward: false, // Get most recent first
    Limit: 1
  }));

  if (!result.Items || result.Items.length === 0) {
    return { statusCode: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },body: JSON.stringify({ message: 'Module not found' }) };
  }

  const item = result.Items[0];
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      id: item.id.S,
      title: item.learningModuleTitle.S,
      modules: JSON.parse(item.rawJson.S || '[]'),
      verified: item.verified?.BOOL ?? false
    })
  };
};