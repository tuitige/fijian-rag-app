// lambda/agents/textract-processor/handler.ts
import { S3Event, Context, S3EventRecord } from 'aws-lambda';
import { TextractClient, StartDocumentTextDetectionCommand, GetDocumentTextDetectionCommand } from '@aws-sdk/client-textract';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Client as OpenSearchClient } from '@opensearch-project/opensearch';
import { v4 as uuidv4 } from 'uuid';

interface TextractBlock {
  BlockType?: string;
  Text?: string;
  Confidence?: number;
  Page?: number;
}

interface TextractResponse {
  JobStatus?: string;
  StatusMessage?: string;
  Blocks?: TextractBlock[];
}

const textractClient = new TextractClient({});
const s3Client = new S3Client({});
const openSearchClient = new OpenSearchClient({
  node: process.env.COLLECTION_ENDPOINT,
  ssl: {
    rejectUnauthorized: false
  }
});

export const handler = async (event: S3Event, context: Context): Promise<void> => {
  try {
    console.log('Processing event:', JSON.stringify(event, null, 2));

    for (const record of event.Records) {
      await processS3Record(record);
    }
  } catch (error) {
    console.error('Error processing event:', error);
    throw error;
  }
};

async function processS3Record(record: S3EventRecord): Promise<void> {
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

  try {
    // Start text detection
    const startResponse = await textractClient.send(
      new StartDocumentTextDetectionCommand({
        DocumentLocation: {
          S3Object: {
            Bucket: bucket,
            Name: key
          }
        }
      })
    );

    if (!startResponse.JobId) {
      throw new Error('No JobId returned from Textract');
    }

    // Poll for completion
    const textractResult = await waitForTextractCompletion(startResponse.JobId);
    
    // Extract text blocks
    const extractedText = textractResult.Blocks
      ?.filter(block => block.BlockType === 'LINE')
      .map(block => block.Text)
      .join('\n') || '';

    // Get original file metadata from S3
    const s3Response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key
      })
    );

    // Save to OpenSearch
    const document = {
      id: uuidv4(),
      type: 'learning_module',
      content: extractedText,
      sourceFile: {
        bucket,
        key,
        lastModified: s3Response.LastModified,
        contentType: s3Response.ContentType
      },
      metadata: {
        processedAt: new Date().toISOString(),
        confidence: calculateAverageConfidence(textractResult.Blocks),
        pageCount: countPages(textractResult.Blocks)
      }
    };

    await openSearchClient.index({
      index: process.env.COLLECTION_NAME || 'fijian-translations',
      body: document,
      refresh: true
    });

    console.log(`Successfully processed and indexed document: ${key}`);
  } catch (error) {
    console.error(`Error processing file ${key} from bucket ${bucket}:`, error);
    throw error;
  }
}

async function waitForTextractCompletion(jobId: string, maxAttempts = 60): Promise<TextractResponse> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const response = await textractClient.send(
      new GetDocumentTextDetectionCommand({
        JobId: jobId
      })
    );

    if (response.JobStatus === 'SUCCEEDED') {
      return response;
    }

    if (response.JobStatus === 'FAILED') {
      throw new Error(`Textract job failed: ${response.StatusMessage}`);
    }

    // Wait 2 seconds before next attempt
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }

  throw new Error('Textract processing timed out');
}

function calculateAverageConfidence(blocks: TextractBlock[] = []): number {
  const confidenceValues = blocks
    .filter((block): block is TextractBlock & { Confidence: number } => 
      typeof block.Confidence === 'number'
    )
    .map(block => block.Confidence);

  if (confidenceValues.length === 0) return 0;

  const sum = confidenceValues.reduce((acc, val) => acc + val, 0);
  return Number((sum / confidenceValues.length).toFixed(2));
}

function countPages(blocks: TextractBlock[] = []): number {
  return new Set(blocks.map(block => block.Page)).size;
}
