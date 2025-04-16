import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { aggregateTextFromS3Folder } from './agents/aggregationAgent';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.BUCKET_NAME!;
const CLAUDE_MODULE_GENERATOR_FN = process.env.CLAUDE_MODULE_GENERATOR_FN!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const prefix = decodeURIComponent(event.queryStringParameters?.prefix || '');

  if (!prefix) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing required prefix query param' })
    };
  }

  try {
    const { fullText, pages } = await aggregateTextFromS3Folder(BUCKET_NAME, prefix);

    // Invoke Claude module generator
    await lambda.send(new InvokeCommand({
      FunctionName: CLAUDE_MODULE_GENERATOR_FN,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify({
        learningModuleTitle: prefix,
        text: fullText
      }))
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Module aggregation and generation initiated', pages })
    };
  } catch (err) {
    console.error('Aggregator error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Internal server error', error: String(err) })
    };
  }
};