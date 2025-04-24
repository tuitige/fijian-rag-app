import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
export const handler = async (event) => {
  const ddb = new DynamoDBClient({});
  const moduleId = event.queryStringParameters?.id;

  const resp = await ddb.send(new GetItemCommand({
    TableName: process.env.LEARNING_MODULES_TABLE!,
    Key: {
      PK: { S: `module#${moduleId}` },
      SK: { S: `meta#${moduleId}` }
    }
  }));

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      id: moduleId,
      ...Object.fromEntries(Object.entries(resp.Item || {}).map(([k, v]) => [k, Object.values(v)[0]]))
    })
  };
};
