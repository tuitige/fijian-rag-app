import { S3Event } from 'aws-lambda';
import { 
  TextractClient, 
  StartDocumentAnalysisCommand,
  GetDocumentAnalysisCommand,
  Block,
  DocumentMetadata
} from '@aws-sdk/client-textract';
import { 
  S3Client, 
  GetObjectCommand 
} from '@aws-sdk/client-s3';
import { 
  DynamoDBClient, 
  PutItemCommand 
} from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const textractClient = new TextractClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

interface LearningModule {
  id: string;
  sourceLanguage: string;
  content: string;
  pageNumber: number;
  learningModuleTitle: string;
  chapter?: string;
  paragraphs: string[];
  createdAt: string;
}

export const handler = async (event: S3Event) => {
  try {
    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    console.log(`Processing file: ${key} from bucket: ${bucket}`);

    // Start document analysis
    console.log('Starting Textract analysis...');
    const startAnalysisResponse = await textractClient.send(
      new StartDocumentAnalysisCommand({
        DocumentLocation: {
          S3Object: {
            Bucket: bucket,
            Name: key
          }
        },
        FeatureTypes: ['TABLES', 'FORMS'],
      })
    );

    const jobId = startAnalysisResponse.JobId;
    console.log(`Textract job started with ID: ${jobId}`);

    // Poll for completion
    let analysisComplete = false;
    let documentAnalysis;
    
    while (!analysisComplete) {
      const getAnalysisResponse = await textractClient.send(
        new GetDocumentAnalysisCommand({
          JobId: jobId
        })
      );

      console.log(`Job status: ${getAnalysisResponse.JobStatus}`);

      if (getAnalysisResponse.JobStatus === 'SUCCEEDED') {
        documentAnalysis = getAnalysisResponse;
        analysisComplete = true;
      } else if (getAnalysisResponse.JobStatus === 'FAILED') {
        throw new Error('Textract analysis failed');
      } else {
        console.log('Waiting for Textract analysis to complete...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Process the extracted text
    const blocks = documentAnalysis!.Blocks || [];
    const paragraphs: string[] = [];
    let currentParagraph = '';

    blocks.forEach((block: Block) => {
      if (block.BlockType === 'LINE') {
        if (block.Text) {
          // If the line ends with a period, question mark, or exclamation mark,
          // treat it as a paragraph break
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
      } else if (block.BlockType === 'SELECTION_ELEMENT' || block.BlockType === 'WORD') {
        // Skip these block types as they're handled within LINE blocks
        return;
      }
    });

    // Add final paragraph if exists
    if (currentParagraph.trim()) {
      paragraphs.push(currentParagraph.trim());
    }

    // Create learning module
    const learningModule: LearningModule = {
      id: uuidv4(),
      sourceLanguage: 'fj', // Assuming Fijian content
      content: paragraphs.join('\n'),
      pageNumber: extractPageNumber(key),
      learningModuleTitle: extractModuleTitle(key),
      paragraphs,
      createdAt: new Date().toISOString()
    };

    // Store in DynamoDB
    await dynamoClient.send(new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: {
        id: { S: learningModule.id },
        sourceLanguage: { S: learningModule.sourceLanguage },
        content: { S: learningModule.content },
        pageNumber: { N: learningModule.pageNumber.toString() },
        learningModuleTitle: { S: learningModule.learningModuleTitle },
        paragraphs: { L: learningModule.paragraphs.map(p => ({ S: p })) },
        createdAt: { S: learningModule.createdAt },
        type: { S: 'LEARNING_MODULE' } // To distinguish from other items in the table
      }
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully processed page and created learning module',
        moduleId: learningModule.id
      })
    };

  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
};

function extractPageNumber(key: string): number {
  // Get the filename without path
  const fileName = key.split('/').pop() || '';
  // For now, just use order of processing
  return 0;  // We'll enhance this later
}

function extractModuleTitle(key: string): string {
  // Extract module name from the folder path
  // e.g., "modules/module1-verbs/image.jpg" -> "module1-verbs"
  const parts = key.split('/');
  if (parts.length >= 2) {
    return parts[parts.length - 2]; // Gets the folder name
  }
  return 'unknown';
}