import { S3Event } from 'aws-lambda';
import { TextractClient, StartDocumentAnalysisCommand, GetDocumentAnalysisCommand } from '@aws-sdk/client-textract';

const textractClient = new TextractClient({ region: process.env.AWS_REGION });

export async function extractParagraphsFromImage(bucket: string, key: string): Promise<string[]> {
  const startResponse = await textractClient.send(new StartDocumentAnalysisCommand({
    DocumentLocation: { S3Object: { Bucket: bucket, Name: key } },
    FeatureTypes: ['TABLES', 'FORMS']
  }));

  const jobId = startResponse.JobId;
  if (!jobId) throw new Error('Textract job failed to start');

  let result;
  while (true) {
    const response = await textractClient.send(new GetDocumentAnalysisCommand({ JobId: jobId }));
    if (response.JobStatus === 'SUCCEEDED') {
      result = response;
      break;
    } else if (response.JobStatus === 'FAILED') {
      throw new Error('Textract job failed');
    }
    await new Promise(res => setTimeout(res, 3000));
  }

  const paragraphs: string[] = [];
  let current = '';
  for (const block of result.Blocks || []) {
    if (block.BlockType === 'LINE' && block.Text) {
      current += block.Text + ' ';
      if (/[.!?]$/.test(block.Text)) {
        paragraphs.push(current.trim());
        current = '';
      }
    }
  }
  if (current.trim()) paragraphs.push(current.trim());
  return paragraphs;
}