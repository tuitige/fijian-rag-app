import { S3Event } from 'aws-lambda';
import { processTextractOCR } from './agents/textractAgent';

export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    try {
      console.log(`📥 Triggered by ${bucket}/${key}`);
      await processTextractOCR(bucket, key);
    } catch (err) {
      console.error(`❌ Error processing ${key}:`, err);
    }
  }
};