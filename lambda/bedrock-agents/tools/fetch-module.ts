import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-west-2' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TRANSLATIONS_TABLE!;
const MODULE_INDEX = 'learningModuleIndex';

export const fetchModule = async (title: string) => {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: MODULE_INDEX,
      KeyConditionExpression: 'learningModuleTitle = :title',
      FilterExpression: '#type = :type',
      ExpressionAttributeNames: { '#type': 'type' },
      ExpressionAttributeValues: {
        ':title': title,
        ':type': 'module',
      },
      ScanIndexForward: false,
      Limit: 1,
    })
  );

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  const item = result.Items[0];
  return {
    id: item.id,
    title: item.learningModuleTitle,
    verified: item.verified ?? false,
    ...item.rawJson,
  };
};