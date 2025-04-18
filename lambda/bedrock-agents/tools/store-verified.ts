import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({ region: 'us-west-2' });
const TABLE_NAME = process.env.TRANSLATIONS_TABLE!;

export const storeVerified = async (id: string, verifiedContent: string) => {
  const command = new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: {
      id: { S: id }
    },
    UpdateExpression: 'SET verified = :true, verifiedResponse = :response',
    ExpressionAttributeValues: {
      ':true': { BOOL: true },
      ':response': { S: verifiedContent }
    }
  });

  await ddb.send(command);
  return { success: true };
};