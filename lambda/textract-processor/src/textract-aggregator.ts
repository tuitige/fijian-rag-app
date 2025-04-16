import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const s3 = new S3Client({ region: 'us-west-2' });
const lambda = new LambdaClient({ region: 'us-west-2' });
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
    const listResponse = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `${prefix}/`
    }));

    const pageObjects = (listResponse.Contents || []).filter(obj => obj.Key?.endsWith('.json'));
    pageObjects.sort((a, b) => (a.Key! > b.Key! ? 1 : -1));

    const pages = [];
    for (const obj of pageObjects) {
      const getRes = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: obj.Key! }));
      const body = await getRes.Body?.transformToString();
      if (!body) continue;

      const parsed = JSON.parse(body);
      const paragraphs = parsed?.paragraphs?.map((p: any) => (typeof p === 'string' ? p : p.S)).filter(Boolean) || [];
      pages.push({ pageNumber: parsed.pageNumber || 0, text: paragraphs.join('\n') });
    }

    // Aggregate all pages into one string
    const sortedPages = pages.sort((a, b) => a.pageNumber - b.pageNumber);
    const fullText = sortedPages.map(p => p.text).join('\n\n');

    // 🔁 Call ClaudeModuleGenerator Lambda with the full text
    const invokeResponse = await lambda.send(new InvokeCommand({
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
      body: JSON.stringify({ message: 'Module aggregation and generation initiated', pages: pages.length })
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