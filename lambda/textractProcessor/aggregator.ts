import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { APIGatewayProxyHandler } from 'aws-lambda';
import { generateEmbedding } from './helpers/generateEmbedding';
import { indexTranslation } from './helpers/indexOpenSearch';
import { generateModuleFromText } from './helpers/callClaude';
import { extractTranslationPairsFromText } from './helpers/extractTranslationPairsFromText';
import { indexToOpenSearch } from './helpers/indexLearningModule';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.BUCKET_NAME!;
const LEARNING_MODULE_INDEX = 'learning-modules';
const TRANSLATIONS_INDEX = 'translations';

export const handler: APIGatewayProxyHandler = async (event) => {
try {
  const moduleName = event.queryStringParameters?.module || JSON.parse(event.body || '{}')?.module;
  if (!moduleName) {
    return { statusCode: 400, body: 'Missing module name.' };
  }

  const prefix = `${moduleName}/`;
  console.log(`🔍 Aggregating module from folder: ${prefix}`);

  // List and load pg*.json files
  const listResp = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
  const jsonFiles = (listResp.Contents || [])
    .filter(obj => obj.Key?.endsWith('.json'))
    .map(obj => obj.Key!) as string[];

  const allParagraphs: string[] = [];

  for (const key of jsonFiles) {
    const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await obj.Body?.transformToString();
    if (body) {
      const parsed = JSON.parse(body);
      if (Array.isArray(parsed.paragraphs)) {
        allParagraphs.push(...parsed.paragraphs);
      }
    }
  }

  console.log(`📄 Total paragraphs: ${allParagraphs.length}`);

  // Claude Pass #1: Generate structured module
  const claudeModule = await generateModuleFromText(allParagraphs, moduleName);
  const moduleId = uuidv4();
  const learningModuleTitle = claudeModule.title || moduleName;

  await indexToOpenSearch(LEARNING_MODULE_INDEX, {
    id: moduleId,
    learningModuleTitle,
    source: 'Claude',
    rawInputText: allParagraphs.join('\n'),
    paragraphs: allParagraphs,
    createdAt: new Date().toISOString(),
    ...claudeModule
  });

  console.log(`📘 Learning module indexed: ${learningModuleTitle}`);

  // Claude Pass #2: Extract Fijian-English translation pairs
  const extractedPhrases = await extractTranslationPairsFromText(allParagraphs);
  console.log(`🧠 Extracted ${extractedPhrases.length} phrase pairs from Claude.`);

  for (const phrase of extractedPhrases) {
    try {
      const embedding = await generateEmbedding(phrase.originalText);
      await indexTranslation({
        originalText: phrase.originalText,
        translatedText: phrase.translatedText,
        verified: false,
        source: 'Claude-extracted',
        embedding,
        moduleId,
        learningModuleTitle
      });
    } catch (err) {
      console.warn(`⚠️ Failed indexing phrase: "${phrase.originalText}"`, err);
    }
  }

  console.log('✅ Aggregator returning successful response...');

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Module aggregated and indexed',
      moduleId,
      phrases: extractedPhrases.length
    })
  };
} catch (error) {
  console.error('❌ AggregatorLambda error:', error);
  return {
    statusCode: 500,
    body: 'Internal server error'
  };
}
};
