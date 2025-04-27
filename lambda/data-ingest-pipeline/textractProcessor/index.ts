import { S3Event } from 'aws-lambda';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { REGION, INGESTION_BUCKET_NAME } from '../constants';

const s3 = new S3Client({ region: REGION });
const textract = new TextractClient({ region: REGION });

export const handler = async (event: S3Event) => {
  console.log('Received S3 event:', JSON.stringify(event, null, 2));

  const records = event.Records || [];

  for (const record of records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    if (!key.toLowerCase().endsWith('.jpg') && !key.toLowerCase().endsWith('.jpeg')) {
      console.log('Skipping non-jpg file:', key);
      continue;
    }

    console.log(`Processing OCR for image: s3://${bucket}/${key}`);

    const params = {
      Document: {
        S3Object: {
          Bucket: bucket,
          Name: key
        }
      }
    };

    const command = new DetectDocumentTextCommand(params);
    const response = await textract.send(command);

    const outputKey = key.replace(/\.[^.]+$/, '.json'); // replace .jpg with .json

    const putCommand = new PutObjectCommand({
      Bucket: INGESTION_BUCKET_NAME,
      Key: outputKey,
      Body: JSON.stringify(response),
      ContentType: 'application/json'
    });

    await s3.send(putCommand);

    console.log(`OCR output saved: s3://${bucket}/${outputKey}`);
  }
};
