import { SQSEvent } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
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

    const { title, s3Prefix, source } = body;

    if (source === 'PeaceCorps' || source === 'FijianGrammar') {
      await processScannedChapter(title, s3Prefix, source);
    } else if (source === 'NaiLalakai') {
      await processTextArticle(title, s3Prefix, source);
    } else {
      console.error('Unknown ingestion source:', source);
    }
  }
};

async function processScannedChapter(title: string, s3Prefix: string, source: string) {
  console.log(`Processing scanned chapter: ${title}`);

  const pagesText = await ocrAndAggregatePages(s3Prefix);

  const module = await BedrockClaudeClient.generateModule(pagesText, title);
  const translations = await BedrockClaudeClient.extractTranslations(pagesText);

  const saveLearningResponse = await saveLearningModule(module);
  console.log('Saved learning module:', saveLearningResponse);
  const saveTranslationsResponse = await saveTranslations(translations, module.moduleId, source);
  console.log('Saved translations:', saveTranslationsResponse);

}

async function processTextArticle(title: string, s3Prefix: string, source: string) {
  console.log(`Processing text article: ${title}`);

  const articleText = await downloadTextFromS3(s3Prefix);

  const translations = await BedrockClaudeClient.extractTranslations(articleText);

  await saveTranslations(translations, undefined, source);
}

async function downloadTextFromS3(s3Prefix: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: INGESTION_BUCKET_NAME,
    Key: s3Prefix
  });

  const response = await s3.send(command);

  if (!response.Body) {
    throw new Error('No Body returned from S3.');
  }

  const streamToString = (stream: any) =>
    new Promise<string>((resolve, reject) => {
      const chunks: any[] = [];
      stream.on('data', (chunk: any) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });

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
    if (!t?.fijian || !t?.english) {
      console.warn('Skipping invalid translation item:', t);
      continue;
    }

    const translationId = uuidv4();

    const baseItem: { [key: string]: { S: string } } = {
      PK: { S: `TRANSLATION#${translationId}` },
      SK: { S: `SOURCE#${source}` },
      translationId: { S: translationId },
      fijian: { S: t.fijian },
      english: { S: t.english },
      source: { S: source },
      status: { S: 'unverified' }
    };

    const item = moduleId
      ? { ...baseItem, moduleId: { S: moduleId } }
      : baseItem;

    await ddb.send(new PutItemCommand({
      TableName: TRANSLATIONS_TABLE,
      Item: item
    }));

    console.log('Saved translation:', t.fijian);
  }
}
