import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { APIGatewayProxyHandler } from 'aws-lambda';
import { generateEmbedding } from '../shared/bedrock/generateEmbedding';
import { indexTranslation } from '../shared/opensearch/indexOpenSearch';
import { generateModuleFromText } from '../shared/bedrock/callClaude';
import { extractTranslationPairsFromText } from './helpers/extractTranslationPairsFromText';
import { extractPeaceCorpsPhrases } from './helpers/extractPeaceCorpsPhrases';
import { indexToOpenSearch } from '../shared/opensearch/indexLearningModule';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBClient, QueryCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { 
  CONTENT_BUCKET_NAME, 
  DDB_LEARNING_MODULES_TABLE, 
  TRANSLATIONS_TABLE, 
  FIJI_RAG_REGION 
} from '../shared/constants.ts';


const s3 = new S3Client({ region: FIJI_RAG_REGION });
const ddb = new DynamoDBClient({ region: FIJI_RAG_REGION });

export const handler: APIGatewayProxyHandler = async (event) => {
try {
  const moduleName = event.queryStringParameters?.module || JSON.parse(event.body || '{}')?.module;
  if (!moduleName) {
    return { statusCode: 400, body: 'Missing module name.' };
  }

  const prefix = `${moduleName}/`;
  console.log(`🔍 Aggregating module from folder: ${prefix}`);

  const sourceParam = event.queryStringParameters?.source || 'FijiReferenceGrammar';
  const source = sourceParam.trim();

  // List and load pg*.json files
  const listResp = await s3.send(new ListObjectsV2Command({ Bucket: CONTENT_BUCKET_NAME, Prefix: prefix }));
  const jsonFiles = (listResp.Contents || [])
    .filter(obj => obj.Key?.endsWith('.json'))
    .map(obj => obj.Key!) as string[];

  const allParagraphs: string[] = [];

  for (const key of jsonFiles) {
    const obj = await s3.send(new GetObjectCommand({ Bucket: CONTENT_BUCKET_NAME, Key: key }));
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

  // Move learning modules to DDB
  // OS only for verified, RAG uses
/*  
  await indexToOpenSearch(LEARNING_MODULE_INDEX, {
    id: moduleId,
    learningModuleTitle,
    source: 'Claude',
    rawInputText: allParagraphs.join('\n'),
    paragraphs: allParagraphs,
    createdAt: new Date().toISOString(),
    ...claudeModule
  });
*/

  const ddbResponse = await ddb.send(new PutItemCommand({
    TableName: DDB_LEARNING_MODULES_TABLE!,
    Item: {
      PK: { S: `module#${moduleId}` },
      SK: { S: `meta#${learningModuleTitle}` },
      id: { S: moduleId },
      learningModuleTitle: { S: learningModuleTitle },
      source: { S: source },
      rawInputText: { S: allParagraphs.join('\n') },
      paragraphs: { L: allParagraphs.map(p => ({ S: p })) },
      topics: { S: JSON.stringify(claudeModule.topics) },
      verified: { S: 'false' },
      type: { S: 'LEARNING_MODULE' },
      createdAt: { S: new Date().toISOString() }
    }
  }));


  console.log(`📘 Learning module index: ${learningModuleTitle}`);
  console.log(`📊 DDB Learning module index response: ${ddbResponse}`);

  // Claude Pass #2: Extract Fijian-English translation pairs
  let extractedPhrases: any[] = [];

  if (source === 'PeaceCorps') {
    extractedPhrases = await extractPeaceCorpsPhrases(allParagraphs);
  } else {
    extractedPhrases = await extractTranslationPairsFromText(allParagraphs);
  }
  console.log(`🧠 Extracted ${extractedPhrases.length} phrase pairs from Claude.`);

/*  
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
        learningModuleTitle,
      });
    } catch (err) {
      console.warn(`⚠️ Failed indexing phrase: "${phrase.originalText}"`, err);
    }
  }
*/

  for (let i = 0; i < extractedPhrases.length; i++) {
    const phrase = extractedPhrases[i];
    const phraseId = uuidv4();

    try {
      await ddb.send(new PutItemCommand({
        TableName: DDB_LEARNING_MODULES_TABLE!,
        Item: {
          PK: { S: `module#${moduleId}` },
          SK: { S: `phrase#${i}` },
          id: { S: phraseId },
          originalText: { S: phrase.originalText },
          translatedText: { S: phrase.translatedText },
          verified: { S: 'false' },
          source: { S: source + '-extracted'},
          moduleId: { S: moduleId },
          learningModuleTitle: { S: learningModuleTitle },
          createdAt: { S: new Date().toISOString() },
          type: { S: 'PHRASE' }
        }
      }));
    } catch (err) {
      console.warn(`⚠️ Failed storing phrase to DDB: "${phrase.originalText}"`, err);
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
