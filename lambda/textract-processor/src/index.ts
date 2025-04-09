// lambda/textract-processor/src/index.ts

import { S3Event } from 'aws-lambda';
import { TextractClient, StartDocumentTextDetectionCommand, GetDocumentTextDetectionCommand } from "@aws-sdk/client-textract";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

// Initialize clients
const textractClient = new TextractClient({});
const s3Client = new S3Client({});
const ddb = DynamoDBDocument.from(new DynamoDB());

interface ProcessedContent {
  moduleId: string;
  title: string;
  content: {
    type: 'vocabulary' | 'grammar' | 'conversation';
    items: Array<{
      term?: string;
      definition?: string;
      example?: string;
    }>;
  }[];
}

export const handler = async (event: S3Event) => {
  try {
    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

      console.log(`Processing new file upload: ${key} in bucket: ${bucket}`);

      // Start Textract job
      const startResponse = await textractClient.send(new StartDocumentTextDetectionCommand({
        DocumentLocation: {
          S3Object: {
            Bucket: bucket,
            Name: key
          }
        }
      }));

      const jobId = startResponse.JobId;
      if (!jobId) {
        throw new Error('Failed to start Textract job');
      }

      // Poll for job completion
      let jobComplete = false;
      while (!jobComplete) {
        const getResult = await textractClient.send(new GetDocumentTextDetectionCommand({
          JobId: jobId
        }));

        if (getResult.JobStatus === 'SUCCEEDED') {
          jobComplete = true;
          
          // Process the extracted text
          const blocks = getResult.Blocks || [];
          const processedContent = await processTextractBlocks(blocks);

          // Store the processed content
          await storeProcessedContent(processedContent);

        } else if (getResult.JobStatus === 'FAILED') {
          throw new Error(`Textract job failed for document ${key}`);
        } else {
          // Wait before polling again
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Processing complete' })
    };

  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
};

async function processTextractBlocks(blocks: any[]): Promise<ProcessedContent> {
  // Extract text from blocks and organize into structured content
  const text = blocks
    .filter(block => block.BlockType === 'LINE')
    .map(block => block.Text)
    .join('\n');

  // TODO: Implement logic to structure the content
  // This is a placeholder implementation
  return {
    moduleId: `module_${Date.now()}`,
    title: 'Untitled Module',
    content: [{
      type: 'vocabulary',
      items: [{
        term: 'Example Term',
        definition: 'Example Definition'
      }]
    }]
  };
}

async function storeProcessedContent(content: ProcessedContent): Promise<void> {
  await ddb.put({
    TableName: process.env.MODULES_TABLE_NAME || 'FijianModules',
    Item: {
      ...content,
      createdAt: new Date().toISOString(),
      status: 'PROCESSED'
    }
  });
}
