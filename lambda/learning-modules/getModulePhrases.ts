import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
export const handler = async (event) => {
  const moduleId = event.queryStringParameters?.moduleId;
  const ddb = new DynamoDBClient({});

  const resp = await ddb.send(new QueryCommand({
    TableName: process.env.DDB_LEARNING_MODULES_TABLE!,
    KeyConditionExpression: 'PK = :pk and begins_with(SK, :phrase)',
    ExpressionAttributeValues: {
      ':pk': { S: `module#${moduleId}` },
      ':phrase': { S: 'phrase#' }
    }
  }));

  const results = (resp.Items || []).map(item =>
    Object.fromEntries(Object.entries(item).map(([k, v]) => [k, Object.values(v)[0]]))
  );

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(results)
  };
};
