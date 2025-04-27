import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { REGION, INGESTION_BUCKET_NAME } from '../constants';

const s3 = new S3Client({ region: REGION });
const textract = new TextractClient({ region: REGION });

export async function ocrAndAggregatePages(s3Prefix: string): Promise<string> {
  console.log(`Aggregating OCR text from prefix: ${s3Prefix}`);

  const jpgKeys = await listJpgKeys(s3Prefix);
  console.log(`Found ${jpgKeys.length} jpg pages.`);

  if (jpgKeys.length === 0) {
    throw new Error('No jpg pages found under prefix: ' + s3Prefix);
  }

  let aggregatedText = '';

  for (const key of jpgKeys) {
    const pageText = await textractPage(key);
    aggregatedText += pageText + '\n\n'; // separate pages
  }

  console.log('Aggregation complete.');
  return aggregatedText;
}

async function listJpgKeys(prefix: string): Promise<string[]> {
  const command = new ListObjectsV2Command({
    Bucket: INGESTION_BUCKET_NAME,
    Prefix: prefix
  });

  const result = await s3.send(command);
  const jpgKeys = (result.Contents || [])
    .map(obj => obj.Key || '')
    .filter(key => key.toLowerCase().endsWith('.jpg') || key.toLowerCase().endsWith('.jpeg'));

  return jpgKeys;
}

async function textractPage(key: string): Promise<string> {
  console.log(`OCR processing page: ${key}`);

  const params = {
    Document: {
      S3Object: {
        Bucket: INGESTION_BUCKET_NAME,
        Name: key
      }
    }
  };

  const command = new DetectDocumentTextCommand(params);
  const response = await textract.send(command);

  const blocks = response.Blocks || [];

  // Extract only text lines
  const lines = blocks
    .filter(block => block.BlockType === 'LINE')
    .map(block => block.Text || '');

  console.log(`Page OCR done: ${lines.length} lines extracted.`);

  return lines.join(' ');
}
