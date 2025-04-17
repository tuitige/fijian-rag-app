import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TRANSLATIONS_TABLE!;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  console.log('Received path:', event.path);
  const title = event.queryStringParameters?.title;
  console.log('Received title:', title);
  if (!title) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing module title' })
    };
  }

  const result = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'typeIndex',
    KeyConditionExpression: '#type = :moduleType AND learningModuleTitle = :title',
    ExpressionAttributeNames: {
      '#type': 'type'
    },
    ExpressionAttributeValues: {
      ':moduleType': 'module',
      ':title': title
    },
    ScanIndexForward: false,
    Limit: 1
  }));

  console.log('DynamoDB result:', JSON.stringify(result, null, 2));

  if (!result.Items || result.Items.length === 0) {
    return { statusCode: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },body: JSON.stringify({ message: 'Module not found' }) };
  }

  const item = result.Items[0];

  //console.log('Item:', JSON.stringify(item, null, 2));
  let modules = [];
  try {
    const parsed = JSON.parse(item.rawJson); // rawJson is a string
    modules = parsed.modules || [];
  } catch (err) {
    console.error('❌ Failed to parse rawJson:', err);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      id: item.id,
      title: item.learningModuleTitle,
      modules,
      verified: item.verified ?? false
    })
  };
};