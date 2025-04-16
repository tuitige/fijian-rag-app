import { TextractClient, StartDocumentAnalysisCommand, GetDocumentAnalysisCommand, Block } from '@aws-sdk/client-textract';

const textract = new TextractClient({ region: process.env.AWS_REGION });

export async function extractParagraphsFromImage(bucket: string, key: string): Promise<string[]> {
  console.log(`🧠 Running Textract on: ${bucket}/${key}`);

  const startCommand = new StartDocumentAnalysisCommand({
    DocumentLocation: { S3Object: { Bucket: bucket, Name: key } },
    FeatureTypes: ['TABLES', 'FORMS']
  });

  const { JobId } = await textract.send(startCommand);
  if (!JobId) throw new Error('Textract job did not return a JobId');

  let blocks: Block[] = [];
  let finished = false;

  while (!finished) {
    const { JobStatus, Blocks, NextToken } = await textract.send(
      new GetDocumentAnalysisCommand({ JobId, NextToken: undefined })
    );

    if (JobStatus === 'SUCCEEDED') {
      blocks = Blocks || [];
      finished = true;
    } else if (JobStatus === 'FAILED') {
      throw new Error('Textract job failed');
    } else {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  const paragraphs: string[] = [];
  let currentParagraph = '';

  blocks.forEach((block) => {
    if (block.BlockType === 'LINE' && block.Text) {
      if (/[.!?]$/.test(block.Text)) {
        currentParagraph += block.Text;
        if (currentParagraph.trim()) {
          paragraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
      } else {
        currentParagraph += block.Text + ' ';
      }
    }
  });

  if (currentParagraph.trim()) paragraphs.push(currentParagraph.trim());

  return paragraphs;
}