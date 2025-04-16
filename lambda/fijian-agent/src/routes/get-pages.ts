import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand
} from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.BUCKET_NAME!;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const prefix = event.queryStringParameters?.prefix;

  if (!prefix) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing ?prefix=chapter-name' })
    };
  }

  try {
    const listResp = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: `${prefix}/pg`
      })
    );

    const jsonFiles = (listResp.Contents || [])
      .map(obj => obj.Key!)
      .filter(key => key.endsWith('.json'))
      .sort();

    const pages: { pageNumber: number; paragraphs: string[] }[] = [];

    for (const key of jsonFiles) {
      const getResp = await s3.send(
        new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
      );

      const body = await getResp.Body?.transformToString();
      const json = body ? JSON.parse(body) : null;

      const pageNumber = json?.pageNumber || extractPageNum(key);
      const paragraphs = Array.isArray(json?.paragraphs)
        ? json.paragraphs
        : json?.paragraphs?.L?.map((p: any) => p.S) || [];

      pages.push({ pageNumber, paragraphs });
    }

    // Sort just in case
    pages.sort((a, b) => a.pageNumber - b.pageNumber);

    return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ pages: pages })
    };
  } catch (err) {
    console.error('get-pages error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to load pages', error: String(err) })
    };
  }
};

function extractPageNum(key: string): number {
  const match = key.match(/pg(\d+)\.json$/);
  return match ? parseInt(match[1], 10) : 0;
}