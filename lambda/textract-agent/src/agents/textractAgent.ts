import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { extractParagraphsFromImage } from '../tools/extractParagraphs';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.S3_BUCKET!;

function extractPageNumber(key: string): number {
  const match = key.match(/pg(\d+)\.jpg$/i);
  return match ? parseInt(match[1], 10) : 0;
}

function extractModuleTitle(key: string): string {
  const parts = key.split('/');
  return parts.length >= 2 ? parts[parts.length - 2] : 'unknown';
}

export async function processTextractOCR(bucket: string, key: string): Promise<void> {
  const paragraphs = await extractParagraphsFromImage(bucket, key);
  const pageNumber = extractPageNumber(key);
  const moduleTitle = extractModuleTitle(key);
  const id = uuidv4();

  const item = {
    id: { S: id },
    type: { S: 'LEARNING_MODULE' },
    sourceLanguage: { S: 'fj' },
    learningModuleTitle: { S: moduleTitle },
    pageNumber: { N: pageNumber.toString() },
    content: { S: paragraphs.join('\n') },
    createdAt: { S: new Date().toISOString() },
    paragraphs: { L: paragraphs.map((p) => ({ S: p })) }
  };

  const jsonOut = {
    id,
    type: 'LEARNING_MODULE',
    sourceLanguage: 'fj',
    learningModuleTitle: moduleTitle,
    pageNumber,
    content: paragraphs.join('\n'),
    createdAt: new Date().toISOString(),
    paragraphs
  };

  // Write to DynamoDB
  await ddb.send(new PutItemCommand({ TableName: TABLE_NAME, Item: item }));

  // Write to S3
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: `${moduleTitle}/pg${pageNumber}.json`,
    Body: JSON.stringify(jsonOut),
    ContentType: 'application/json'
  }));

  console.log(`✅ OCR result saved for ${key}`);
}