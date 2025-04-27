import { SQSEvent } from 'aws-lambda';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { IngestSqsMessage } from '../types';
import { REGION, INGESTION_BUCKET_NAME, TRANSLATIONS_TABLE, LEARNING_MODULES_TABLE } from '../constants';
import { BedrockClaudeClient } from '../utils/claudeClient';
import { v4 as uuidv4 } from 'uuid';
import { ocrAndAggregatePages } from '../utils/ocrAggregator';


const s3 = new S3Client({ region: REGION });
const ddb = new DynamoDBClient({ region: REGION });

export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body) as IngestSqsMessage;

    console.log('Processing message:', body);

    const { type, title, s3Prefix, source } = body;

    if (type === 'PeaceCorps' || type === 'FijianGrammar') {
      await processScannedChapter(title, s3Prefix, source);
    } else if (type === 'NaiLalakai') {
      await processTextArticle(title, s3Prefix, source);
    } else {
      console.error('Unknown ingestion type:', type);
    }
  }
};

async function processScannedChapter(title: string, s3Prefix: string, source: string) {
  console.log(`Processing scanned chapter: ${title}`);

  const pagesText = await ocrAndAggregatePages(s3Prefix);

  const module = await BedrockClaudeClient.generateModule(pagesText, title);
  const translations = await BedrockClaudeClient.extractTranslations(pagesText);

  await saveLearningModule(module);
  await saveTranslations(translations, module.moduleId, source);
}

async function processTextArticle(title: string, s3Prefix: string, source: string) {
  console.log(`Processing text article: ${title}`);

  const articleText = await downloadTextFromS3(s3Prefix);

  const translations = await BedrockClaudeClient.extractTranslations(articleText);

  await saveTranslations(translations, undefined, source);
}

// --- Helper functions ---

/*
async function ocrAndAggregatePages(s3Prefix: string): Promise<string> {
  // TODO: Download all jpgs from s3Prefix, Textract OCR each, aggregate paragraphs
  return 'Aggregated chapter text here...'; // placeholder
}
*/

async function downloadTextFromS3(s3Prefix: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: INGESTION_BUCKET_NAME,
      Key: s3Prefix
    });
    const response = await s3.send(command);
  
    const streamToString = (stream: any) =>
      new Promise<string>((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk: any) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      });
  
    if (!response.Body) {
      throw new Error('No Body returned from S3.');
    }
  
    return streamToString(response.Body as any);
  }

async function saveLearningModule(module: any) {
  const item = {
    moduleId: { S: module.moduleId },
    title: { S: module.title },
    description: { S: module.description },
    steps: { S: JSON.stringify(module.steps) }
  };

  await ddb.send(new PutItemCommand({
    TableName: LEARNING_MODULES_TABLE,
    Item: item
  }));

  console.log('Saved module to DDB:', module.moduleId);
}

async function saveTranslations(translations: any[], moduleId: string | undefined, source: string) {
  for (const t of translations) {
    const item = {
      translationId: { S: uuidv4() },
      fijian: { S: t.fijian },
      english: { S: t.english },
      source: { S: source },
      status: { S: 'unverified' }
    };

    if (moduleId) {
      item['moduleId'] = { S: moduleId };
    }

    await ddb.send(new PutItemCommand({
      TableName: TRANSLATIONS_TABLE,
      Item: item
    }));

    console.log('Saved translation:', t.fijian);
  }
}
