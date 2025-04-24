import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
export const handler = async (event) => {
  const moduleId = event.queryStringParameters?.moduleId;
  const TableName = process.env.DDB_LEARNING_MODULES_TABLE!;
  const ddb = new DynamoDBClient({});

  console.log('DDB Table:', TableName);
  console.log('Module ID:', moduleId);

  const command = new QueryCommand({
    TableName,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': { S: `module#${moduleId}` },
      ':prefix': { S: 'phrase#' }
    }
  });

  const resp = await ddb.send(command);

  const phrases = (resp.Items || []).map(item =>
    Object.fromEntries(Object.entries(item).map(([k, v]) => [k, Object.values(v)[0]]))
  );

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(phrases)
  };
};
