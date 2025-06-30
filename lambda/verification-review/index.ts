import { APIGatewayProxyHandler } from 'aws-lambda';
import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
  PutItemCommand,
  ScanCommand
} from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { marshall } from '@aws-sdk/util-dynamodb';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { createHash } from 'crypto';

const ddb = new DynamoDBClient({});
const s3 = new S3Client({});

const TRANSLATIONS_REVIEW_TABLE_NAME = process.env.TRANSLATIONS_REVIEW_TABLE_NAME!;
const VERIFIED_TRANSLATIONS_TABLE = process.env.VERIFIED_TRANSLATIONS_TABLE!;
const VERIFIED_VOCAB_TABLE = process.env.VERIFIED_VOCAB_TABLE!;
const TRAINING_BUCKET = process.env.TRAINING_BUCKET!;
const ENABLE_AUTO_VALIDATION = process.env.ENABLE_AUTO_VALIDATION === 'true';


import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { v4 as uuidv4 } from 'uuid';

const OS_ENDPOINT = process.env.OS_ENDPOINT!;
const OS_INDEX_PREFIX = 'verified-';

function getOpenSearchIndex(type: string): string {
  switch (type) {
    case 'paragraph':
      return 'verified-paragraphs';
    case 'phrase':
      return 'verified-phrases';
    case 'vocab':
      return 'verified-vocab';
    default:
      throw new Error(`[OpenSearch] Unsupported data type: ${type}`);
  }
}

async function indexToOpenSearch(item: any, type: 'phrase' | 'vocab' | 'paragraph') {
  const document = {
    id: uuidv4(),
    type,
    ...item,
    embedding: await getEmbedding(`${item.fijian || item.word || item.originalText}`),
  };

const host = OS_ENDPOINT.replace(/^https?:\/\//, '');
const index = getOpenSearchIndex(type);  // type = paragraph, phrase, or vocab
const path = `/${index}/_doc/${document.id}`;

  console.log('[OpenSearch] Indexing document:', {
    index,
    host,
    path,
    document,
  });

const request = new HttpRequest({
  method: 'PUT',
  hostname: host,
  path,
  headers: {
    'Content-Type': 'application/json',
    host, // this is required for AWS Signature to be valid
  },
  body: JSON.stringify(document),
});

const signer = new SignatureV4({
  credentials: defaultProvider(),
  region: process.env.AWS_REGION || 'us-west-2',
  service: 'es',
  sha256: Sha256,
});

  const signed = await signer.sign(request);
  const { response } = await new NodeHttpHandler().handle(signed as HttpRequest);
  if (response.statusCode !== 200 && response.statusCode !== 201) {
    throw new Error(`[OpenSearch] Failed to index document: ${response.statusCode}`);
  }
}

async function storeTrainingDataToS3(item: any, type: 'phrase' | 'vocab' | 'paragraph') {
  const id = item.dataKey || uuidv4();

  // 1. Main format (same as before)
  await s3.send(new PutObjectCommand({
    Bucket: TRAINING_BUCKET,
    Key: `${type}s/${id}.json`,
    Body: JSON.stringify(item, null, 2),
    ContentType: 'application/json',
  }));

  // 2. HuggingFace instruction tuning format
  const hfExample = {
    instruction: `Translate this Fijian ${type}: "${item.fijian || item.word || item.originalText}"`,
    input: '',
    output: item.english || item.meaning || item.translatedText
  };

  await s3.send(new PutObjectCommand({
    Bucket: TRAINING_BUCKET,
    Key: `huggingface/${type}-${id}.json`,
    Body: JSON.stringify(hfExample, null, 2),
    ContentType: 'application/json',
  }));

  // 3. Ollama chat-style format (JSONL line per example)
  const ollamaExample = {
    messages: [
      { role: "user", content: `Translate this Fijian ${type}: "${item.fijian || item.word || item.originalText}"` },
      { role: "assistant", content: item.english || item.meaning || item.translatedText }
    ]
  };

  await s3.send(new PutObjectCommand({
    Bucket: TRAINING_BUCKET,
    Key: `ollama/${type}-${id}.json`,
    Body: JSON.stringify(ollamaExample) + '\n',
    ContentType: 'application/json',
  }));
}


async function getEmbedding(text: string): Promise<number[]> {
  const bedrock = new BedrockRuntimeClient({});
  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v1',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({ inputText: text })
  });

  const response = await bedrock.send(command);
  const result = JSON.parse(Buffer.from(response.body).toString());
  return result.embedding;
}

async function autoValidate(original: string, translation: string): Promise<boolean> {
  if (!ENABLE_AUTO_VALIDATION) return true;
  try {
    const client = new BedrockRuntimeClient({});
    const cmd = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        messages: [
          { role: 'user', content: `Is the English phrase \"${translation}\" a correct translation of \"${original}\"? Answer yes or no.` }
        ],
        max_tokens: 1
      })
    });
    const res = await client.send(cmd);
    const txt = Buffer.from(res.body).toString();
    return /yes/i.test(txt);
  } catch (err) {
    console.warn('[autoValidate] failed', err);
    return true;
  }
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const method = event.httpMethod;
  const path = event.path;

  if (method === 'GET' && path.endsWith('/verify-items')) {
    const type = event.queryStringParameters?.type;
    if (!type) {
      return jsonResponse(400, { error: 'Missing query param: type' });
    }

    const items = await ddb.send(new QueryCommand({
      TableName: TRANSLATIONS_REVIEW_TABLE_NAME,
      IndexName: 'GSI_VerifiedIndex',
      KeyConditionExpression: 'verified = :v AND dataType = :t',
      ExpressionAttributeValues: {
        ':v': { S: 'false' },
        ':t': { S: type }
      },
      Limit: 100 // adjustable for pagination
    }));

    // Step 2: Fetch stats for all types
    const dataTypes = ['paragraph', 'phrase', 'vocab'];
    const stats: Record<string, { total: number, verified: number }> = {};

    for (const dt of dataTypes) {
      const scanResult = await ddb.send(new ScanCommand({
        TableName: TRANSLATIONS_REVIEW_TABLE_NAME,
        FilterExpression: 'dataType = :dt',
        ExpressionAttributeValues: {
          ':dt': { S: dt }
        },
        ProjectionExpression: 'verified'
      }));

      const allItems = scanResult.Items || [];
      //const verifiedCount = allItems.filter(i => i.verified?.BOOL === true).length;      
      const verifiedCount = allItems.filter(i => i.verified?.S === 'true').length;

      stats[dt] = {
        total: allItems.length,
        verified: verifiedCount
      };
    }


    return jsonResponse(200, {
      count: items.Items?.length || 0,
      items: items.Items?.map(flattenItem),
      stats
    });
  }

if (method === 'POST' && path.endsWith('/verify-item')) {
  const body = JSON.parse(event.body || '{}');
  const { dataType, dataKey, fields } = body;

  if (!dataType || !dataKey || !fields) {
    return jsonResponse(400, { error: 'Missing dataType, dataKey, or fields' });
  }

  const pass = await autoValidate(fields.sourceText || fields.word || fields.originalText, fields.translatedText || fields.meaning);
  if (!pass) {
    await ddb.send(new UpdateItemCommand({
      TableName: TRANSLATIONS_REVIEW_TABLE_NAME,
      Key: { dataType: { S: dataType }, dataKey: { S: dataKey } },
      UpdateExpression: 'SET needsReview = :r',
      ExpressionAttributeValues: { ':r': { S: 'true' } }
    }));
    return jsonResponse(200, { status: 'Flagged for manual review' });
  }

  // 1. Mark as verified in the review table
  await ddb.send(new UpdateItemCommand({
    TableName: TRANSLATIONS_REVIEW_TABLE_NAME,
    Key: {
      dataType: { S: dataType },
      dataKey: { S: dataKey }
    },
    UpdateExpression: 'SET verified = :v',
    ExpressionAttributeValues: {
      ':v': { S: 'true' }
    }
  }));

  // 2. Prepare the unified item structure
  const item = {
    ...fields,
    dataKey,
    dataType,
    verified: true
  };

  // 3. Store to correct verified table
  if (dataType === 'phrase') {
    await ddb.send(new PutItemCommand({
      TableName: VERIFIED_TRANSLATIONS_TABLE,
      Item: marshall({
        fijian: fields.sourceText,
        english: fields.translatedText,
        source: dataKey,
        verified: true
      }, { removeUndefinedValues: true })
    }));

  } else if (dataType === 'vocab') {
    await ddb.send(new PutItemCommand({
      TableName: VERIFIED_VOCAB_TABLE,
      Item: marshall({
        word: fields.sourceText,
        meaning: fields.translatedText,
        partOfSpeech: fields.partOfSpeech,
        source: dataKey,
        verified: true
      }, { removeUndefinedValues: true })
    }));

  } else if (dataType === 'paragraph') {
    const articleId = createHash('md5').update(fields.articleUrl).digest('hex');

    await ddb.send(new PutItemCommand({
      TableName: process.env.VERIFIED_PARAGRAPHS_TABLE!,
      Item: marshall({
        articleId,
        paragraphId: dataKey,
        originalText: fields.sourceText,
        translatedText: fields.translatedText,
        verified: true
      }, { removeUndefinedValues: true })
    }));
  }

  // 4. Save to OpenSearch and S3
  await indexToOpenSearch(item, dataType);
  await storeTrainingDataToS3(item, dataType);

  return jsonResponse(200, { status: 'Verified and saved' });
}


  return jsonResponse(404, { error: 'Unsupported route or method' });
};

function jsonResponse(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function flattenItem(item: any): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(item)) {
    flat[k] = (v as any).S;
  }
  return flat;
}
