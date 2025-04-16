import { S3Event } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { extractParagraphsFromImage } from './agents/ocrAgent';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.S3_BUCKET!;

export const handler = async (event: S3Event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    const paragraphs = await extractParagraphsFromImage(bucket, key);
    const pageMatch = key.match(/pg(\d+)\.jpg$/i);
    const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : 0;
    const title = key.split('/')[0];

    const learningModule = {
      id: uuidv4(),
      sourceLanguage: 'fj',
      content: paragraphs.join('\n'),
      pageNumber,
      learningModuleTitle: title,
      paragraphs,
      createdAt: new Date().toISOString(),
      type: 'LEARNING_MODULE'
    };

    await ddb.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        id: { S: learningModule.id },
        sourceLanguage: { S: learningModule.sourceLanguage },
        content: { S: learningModule.content },
        pageNumber: { N: learningModule.pageNumber.toString() },
        learningModuleTitle: { S: learningModule.learningModuleTitle },
        paragraphs: { L: learningModule.paragraphs.map(p => ({ S: p })) },
        createdAt: { S: learningModule.createdAt },
        type: { S: learningModule.type }
      }
    }));

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${title}/pg${pageNumber}.json`,
      Body: JSON.stringify(learningModule),
      ContentType: 'application/json'
    }));
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Textract processing complete' })
  };
};