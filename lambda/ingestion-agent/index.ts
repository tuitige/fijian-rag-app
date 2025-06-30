import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const ddb = new DynamoDBClient({});
const lambda = new LambdaClient({});

const QUEUE_TABLE = process.env.ARTICLE_QUEUE_TABLE!;
const INGESTION_FUNCTION_NAME = process.env.INGESTION_FUNCTION_NAME!;

export const handler = async () => {
  const scan = await ddb.send(new ScanCommand({
    TableName: QUEUE_TABLE,
    FilterExpression: 'attribute_not_exists(processedAt)',
    Limit: 5
  }));

  const tasks = scan.Items || [];
  for (const item of tasks) {
    const url = item.url?.S;
    if (!url) continue;
    await lambda.send(new InvokeCommand({
      FunctionName: INGESTION_FUNCTION_NAME,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify({ type: 'article', url }))
    }));

    await ddb.send(new UpdateItemCommand({
      TableName: QUEUE_TABLE,
      Key: { url: { S: url } },
      UpdateExpression: 'SET processedAt = :now',
      ExpressionAttributeValues: { ':now': { S: new Date().toISOString() } }
    }));
  }

  return { statusCode: 200, body: `Triggered ${tasks.length} articles` };
};
