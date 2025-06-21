import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { indexToOpenSearch, createEmbedding } from '../process-learning-module/opensearch';
import { ChapterExtraction, TranslationItem } from '../process-learning-module/interfaces';

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});

const CONTENT_BUCKET = process.env.CONTENT_BUCKET!;
const LEARNING_MODULES_TABLE = process.env.LEARNING_MODULES_TABLE!;
const MODULE_VOCABULARY_TABLE = process.env.MODULE_VOCABULARY_TABLE!;
const VERIFIED_TRANSLATIONS_TABLE = process.env.VERIFIED_TRANSLATIONS_TABLE!;
const VERIFIED_VOCAB_TABLE = process.env.VERIFIED_VOCAB_TABLE!;

async function fetchS3ObjectAsString(bucket: string, key: string): Promise<string> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`Empty body for s3://${bucket}/${key}`);
  const chunks: Uint8Array[] = [];
  for await (const chunk of res.Body as any) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf-8') : chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

export const handler = async (event: S3Event | any) => {
  console.log('Event received:', JSON.stringify(event, null, 2));
  if (!event.Records || !event.Records[0].s3) {
    return { statusCode: 400, body: 'No valid S3 event' };
  }
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log(`Processing module JSON from s3://${bucket}/${key}`);

  const jsonText = await fetchS3ObjectAsString(bucket, key);
  const extraction: ChapterExtraction = JSON.parse(jsonText);

  await storeChapterData(extraction);
  await indexChapterContent(extraction);

  return { statusCode: 200, body: 'Processing complete' };
};

async function storeChapterData(extraction: ChapterExtraction) {
  const lesson = extraction.chapterMetadata.lesson;
  const moduleId = `ch${lesson}`;
  const timestamp = new Date().toISOString();

  const metadataItem = {
    moduleId,
    contentType: 'metadata',
    chapter: lesson.split('.')[0],
    lessonNumber: parseFloat(lesson),
    lesson: lesson,
    title: extraction.chapterMetadata.title,
    subtitle: extraction.chapterMetadata.subtitle,
    pageRange: extraction.chapterMetadata.pageRange,
    source: extraction.chapterMetadata.source,
    totalPages: extraction.chapterMetadata.totalPages,
    learningObjectives: JSON.stringify(extraction.chapterMetadata.learningObjectives || []),
    prerequisiteLessons: JSON.stringify(extraction.chapterMetadata.prerequisiteLessons || []),
    createdAt: timestamp,
    status: 'processed'
  };

  await ddb.send(new PutItemCommand({
    TableName: LEARNING_MODULES_TABLE,
    Item: marshall(metadataItem, { removeUndefinedValues: true })
  }));

  const vocabRequests: any[] = [];
  let vocabCount = 0;

  for (const [category, items] of Object.entries(extraction.translationPairs)) {
    for (const item of items as TranslationItem[]) {
      const vocabId = `${moduleId}_vocab_${++vocabCount}`;
      vocabRequests.push({
        PutRequest: {
          Item: marshall({
            vocabularyId: vocabId,
            moduleId,
            category,
            ...item,
            createdAt: timestamp
          })
        }
      });

      await ddb.send(new PutItemCommand({
        TableName: VERIFIED_TRANSLATIONS_TABLE,
        Item: marshall({
          fijian: item.fijian,
          english: item.english,
          type: item.type,
          source: 'peace_corps_manual',
          moduleId,
          verified: true,
          verifiedAt: timestamp
        })
      }));

      if (item.type !== 'phrase' && !item.fijian.includes(' ')) {
        await ddb.send(new PutItemCommand({
          TableName: VERIFIED_VOCAB_TABLE,
          Item: marshall({
            word: item.fijian,
            meaning: item.english,
            partOfSpeech: item.type,
            source: 'peace_corps_manual',
            moduleId,
            verified: true,
            verifiedAt: timestamp
          })
        }));
      }
    }
  }

  for (let i = 0; i < vocabRequests.length; i += 25) {
    await ddb.send(new BatchWriteItemCommand({
      RequestItems: {
        [MODULE_VOCABULARY_TABLE]: vocabRequests.slice(i, i + 25)
      }
    }));
  }

  if (extraction.grammarRules.length) {
    await ddb.send(new PutItemCommand({
      TableName: LEARNING_MODULES_TABLE,
      Item: marshall({
        moduleId,
        contentType: 'grammar',
        rules: JSON.stringify(extraction.grammarRules),
        createdAt: timestamp
      })
    }));
  }
  if (extraction.exercises.length) {
    await ddb.send(new PutItemCommand({
      TableName: LEARNING_MODULES_TABLE,
      Item: marshall({
        moduleId,
        contentType: 'exercises',
        exercises: JSON.stringify(extraction.exercises),
        createdAt: timestamp
      })
    }));
  }
  if (extraction.culturalNotes.length) {
    await ddb.send(new PutItemCommand({
      TableName: LEARNING_MODULES_TABLE,
      Item: marshall({
        moduleId,
        contentType: 'cultural',
        notes: JSON.stringify(extraction.culturalNotes),
        createdAt: timestamp
      })
    }));
  }

  console.log(`Stored module ${moduleId} with ${vocabCount} vocab items.`);
}

async function indexChapterContent(extraction: ChapterExtraction) {
  const indexPromises: Promise<any>[] = [];

  for (const [category, items] of Object.entries(extraction.translationPairs)) {
    for (const item of items as TranslationItem[]) {
      const contextString = `Fijian: "${item.fijian}"\nEnglish: "${item.english}"\nType: ${item.type}\nCategory: ${category}`;
      const embedding = await createEmbedding(contextString);
      indexPromises.push(
        indexToOpenSearch({
          index: 'fijian-learning-modules',
          id: uuidv4(),
          body: {
            contentType: 'vocabulary',
            moduleId: `ch${extraction.chapterMetadata.lesson}`,
            fijian: item.fijian,
            english: item.english,
            type: item.type,
            category,
            usageNotes: item.usageNotes,
            page: item.page,
            embedding,
            lessonTitle: extraction.chapterMetadata.title,
            verified: true,
            source: 'peace_corps_manual',
            timestamp: new Date().toISOString()
          }
        })
      );
    }
  }

  for (const rule of extraction.grammarRules) {
    const ruleContext = `Grammar concept: ${rule.concept}\nExplanation: ${rule.explanation}`;
    const embedding = await createEmbedding(ruleContext);
    indexPromises.push(
      indexToOpenSearch({
        index: 'fijian-learning-modules',
        id: uuidv4(),
        body: {
          contentType: 'grammar',
          moduleId: `ch${extraction.chapterMetadata.lesson}`,
          concept: rule.concept,
          explanation: rule.explanation,
          pattern: rule.pattern,
          examples: rule.examples,
          page: rule.page,
          embedding,
          lessonTitle: extraction.chapterMetadata.title,
          timestamp: new Date().toISOString()
        }
      })
    );
  }

  await Promise.all(indexPromises);
  console.log(`Indexed ${indexPromises.length} documents to OpenSearch.`);
}

