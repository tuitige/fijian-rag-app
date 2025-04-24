// listLearningModules.ts
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});

export const handler = async () => {
  const TableName = process.env.DDB_LEARNING_MODULES_TABLE!;

  const scan = await ddb.send(new ScanCommand({
    TableName,
    FilterExpression: '#type = :modType',
    ExpressionAttributeNames: { '#type': 'type' },
    ExpressionAttributeValues: { ':modType': { S: 'LEARNING_MODULE' } }
  }));

  const modules = (scan.Items || []).map(item =>
    Object.fromEntries(
      Object.entries(item).map(([k, v]) => [k, Object.values(v)[0]])
    )
  );

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(modules)
  };
};
