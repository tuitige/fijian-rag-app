import { S3Event } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  TextractClient,
  StartDocumentAnalysisCommand,
  GetDocumentAnalysisCommand,
  Block
} from '@aws-sdk/client-textract';
import { v4 as uuidv4 } from 'uuid';
import { extractShortPhrases } from './helpers/parseText';
import { generateEmbedding } from './helpers/generateEmbedding';
import { indexTranslation } from './helpers/indexOpenSearch';
import { generateModuleFromText } from './helpers/callClaude';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

const textractClient = new TextractClient({ region: process.env.AWS_REGION });

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.BUCKET_NAME!;

export const handler = async (event: S3Event) => {
  try {
    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    console.log(`📄 Processing file: ${key} from bucket: ${bucket}`);

    // Step 1: Textract OCR
    const startAnalysisResponse = await textractClient.send(
      new StartDocumentAnalysisCommand({
        DocumentLocation: { S3Object: { Bucket: bucket, Name: key } },
        FeatureTypes: ['TABLES', 'FORMS'],
      })
    );

    const jobId = startAnalysisResponse.JobId;
    console.log(`🪪 Textract job started: ${jobId}`);

    let analysisComplete = false;
    let documentAnalysis;
    while (!analysisComplete) {
      const getAnalysisResponse = await textractClient.send(
        new GetDocumentAnalysisCommand({ JobId: jobId })
      );

      if (getAnalysisResponse.JobStatus === 'SUCCEEDED') {
        documentAnalysis = getAnalysisResponse;
        analysisComplete = true;
      } else if (getAnalysisResponse.JobStatus === 'FAILED') {
        throw new Error('Textract analysis failed');
      } else {
        console.log('⏳ Waiting for Textract analysis to complete...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Step 2: Paragraph aggregation
    const blocks = documentAnalysis?.Blocks || [];
    const paragraphs: string[] = [];
    let currentParagraph = '';
    for (const block of blocks) {
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
    }
    if (currentParagraph.trim()) paragraphs.push(currentParagraph.trim());

    
    const learningModuleTitle = extractModuleTitle(key);
    const pageNumber = extractPageNumber(key);
/*
    // Step 3: Claude generation
    const module = await generateModuleFromText(paragraphs, learningModuleTitle);
    const moduleId = uuidv4();

    const fullDoc = {
      id: moduleId,
      source: 'Claude',
      learningModuleTitle,
      pageNumber,
      createdAt: new Date().toISOString(),
      paragraphs,
      rawInputText: paragraphs.join('\n'),
      ...module
    };

    await indexToOpenSearch(LEARNING_MODULE_INDEX, fullDoc);

    // Step 4: Index short phrases
    const phrases = extractShortPhrases(paragraphs);
    for (const phrase of phrases) {
      try {
        const embedding = await generateEmbedding(phrase);
        await indexTranslation(phrase, embedding);
      } catch (err) {
        console.warn(`⚠️ Failed indexing phrase: "${phrase}"`, err);
      }
    }
*/

    // Output paragraph data to S3 as pgN.json
    const fileName = key.split('/').pop()?.replace(/\.(jpg|png)$/i, '.json') || 'pgX.json';
    const jsonKey = `${learningModuleTitle}/${fileName}`;

    const s3PutReq = new PutObjectCommand({
      Bucket: BUCKET,
      Key: jsonKey,
      Body: JSON.stringify({ paragraphs }),
      ContentType: 'application/json',
    });

    const s3PutResp = await s3Client.send(s3PutReq);
    console.log(`✅ OCR output stored as: ${s3PutResp}`);

    return {
      statusCode: 200,
      body: JSON.stringify({s3PutResp})
    };

  } catch (err) {
    console.error('❌ TextractProcessor error:', err);
    throw err;
  }
};

function extractModuleTitle(key: string): string {
  const parts = key.split('/');
  return parts.length >= 2 ? parts[parts.length - 2] : 'unknown';
}

function extractPageNumber(key: string): number {
  const fileName = key.split('/').pop() || '';
  const match = fileName.match(/(\d+)/); // extract number from filename
  return match ? parseInt(match[1]) : 0;
}

/*
async function indexToOpenSearch(index: string, doc: any) {
  const req = new HttpRequest({
    method: 'POST',
    hostname: OS_ENDPOINT.replace(/^https?:\/\//, ''),
    path: `/${index}/_doc`,
    body: JSON.stringify(doc),
    headers: {
      host: OS_ENDPOINT,
      'Content-Type': 'application/json',
    },
  });

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: REGION,
    service: 'es',
    sha256: Sha256,
  });

  const signed = await signer.sign(req);
  await new NodeHttpHandler().handle(signed as any);
}
*/