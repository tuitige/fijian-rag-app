// lambda/get-module.ts
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { APIGatewayProxyHandler } from 'aws-lambda';

const s3 = new S3Client({ region: 'us-west-2' });
const BUCKET_NAME = process.env.CONTENT_BUCKET!;

export const handler: APIGatewayProxyHandler = async (event) => {
  const title = event.queryStringParameters?.title;
  if (!title) {
    return { statusCode: 400, body: 'Missing title parameter' };
  }

  const key = `learning-modules/${decodeURIComponent(title)}/module.json`;

  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));

    const body = await response.Body!.transformToString();
    const cleaned = body.startsWith('```json') ? body.split('```json')[1].split('```')[0].trim() : body;
    return {
      statusCode: 200,
      body: cleaned,
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error('Error fetching module:', error);
    return { statusCode: 500, body: 'Failed to fetch module' };
  }
};