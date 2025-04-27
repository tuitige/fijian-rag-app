import { APIGatewayProxyHandler } from 'aws-lambda';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { REGION, INGESTION_BUCKET_NAME, WORKER_SQS_QUEUE_URL } from '../constants';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3Client({ region: REGION });
const sqs = new SQSClient({ region: REGION });

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');

    const s3Prefix = body.s3Prefix;
    const title = body.title;
    const source = body.source;

    if (!s3Prefix || !title || !source) {
      return response(400, 'Missing s3Prefix, title, or source in request body.');
    }

    console.log('Aggregating OCR outputs from:', s3Prefix);

    const aggregatedText = await aggregateOCRText(s3Prefix);

    const sqsPayload = {
      aggregatedText,
      title,
      source
    };

    console.log('Sending message to Worker SQS...');

    const command = new SendMessageCommand({
      QueueUrl: WORKER_SQS_QUEUE_URL,
      MessageBody: JSON.stringify(sqsPayload)
    });

    await sqs.send(command);

    console.log('Message sent to SQS.');

    return response(200, 'Aggregation and dispatch complete.');
  } catch (error) {
    console.error('Aggregator error:', error);
    return response(500, 'Internal server error.');
  }
};

async function aggregateOCRText(s3Prefix: string): Promise<string> {
  const listCommand = new ListObjectsV2Command({
    Bucket: INGESTION_BUCKET_NAME,
    Prefix: s3Prefix
  });

  const listResult = await s3.send(listCommand);
  const keys = (listResult.Contents || [])
    .map(obj => obj.Key || '')
    .filter(key => key.toLowerCase().endsWith('.json'));

  console.log(`Found ${keys.length} JSON files.`);

  if (keys.length === 0) {
    throw new Error('No OCR JSON files found.');
  }

  let aggregatedText = '';

  for (const key of keys) {
    const getCommand = new GetObjectCommand({
      Bucket: INGESTION_BUCKET_NAME,
      Key: key
    });

    const response = await s3.send(getCommand);
    const pageText = await streamToString(response.Body as any);

    const parsed = JSON.parse(pageText);

    const blocks = parsed.Blocks || [];
    const lines = blocks
      .filter((b: any) => b.BlockType === 'LINE')
      .map((b: any) => b.Text || '');

    aggregatedText += lines.join(' ') + '\n\n'; // space sentences, newlines between pages
  }

  return aggregatedText;
}

async function streamToString(stream: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on('data', (chunk: any) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

function response(statusCode: number, message: string) {
  return {
    statusCode,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ message })
  };
}
