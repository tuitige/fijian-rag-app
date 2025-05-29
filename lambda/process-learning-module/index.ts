// lambda/process-learning-module/index.ts

import { S3Event, APIGatewayProxyHandler } from 'aws-lambda';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { getAnthropicApiKey } from '../shared/utils';
import { indexToOpenSearch, createEmbedding } from './opensearch';

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});

const CONTENT_BUCKET = process.env.CONTENT_BUCKET!;
const LEARNING_MODULES_TABLE = process.env.LEARNING_MODULES_TABLE!;
const MODULE_VOCABULARY_TABLE = process.env.MODULE_VOCABULARY_TABLE!;
const VERIFIED_TRANSLATIONS_TABLE = process.env.VERIFIED_TRANSLATIONS_TABLE!;
const VERIFIED_VOCAB_TABLE = process.env.VERIFIED_VOCAB_TABLE!;

interface ChapterManifest {
  chapter: string;
  topic: string;
  startPage: number;
  totalPages: number;
  files: string[];
  timestamp: string;
  s3Prefix: string;
}

interface ChapterExtraction {
  chapterMetadata: {
    lesson: string;
    title: string;
    subtitle: string;
    pageRange: string;
    source: string;
    totalPages: number;
    learningObjectives: string[];
    prerequisiteLessons?: string[];
  };
  translationPairs: {
    [category: string]: TranslationItem[];
  };
  grammarRules: GrammarRule[];
  exercises: Exercise[];
  culturalNotes: CulturalNote[];
  dialogues?: Dialogue[];
  visualAids?: VisualAid[];
}

interface TranslationItem {
  fijian: string;
  english: string;
  type: string;
  page: number;
  usageNotes?: string;
  pronunciation?: string;
  verified: boolean;
  source: string;
}

interface GrammarRule {
  concept: string;
  explanation: string;
  pattern?: string;
  examples: Array<{
    fijian: string;
    english: string;
    breakdown?: string;
  }>;
  page: number;
}

interface Exercise {
  type: string;
  instruction: string;
  content?: string;
  page: number;
}

interface CulturalNote {
  note: string;
  pages?: number[];
}

interface Dialogue {
  id: string;
  topic: string;
  participants?: string[];
  page: number;
}

interface VisualAid {
  type: string;
  description: string;
  pages: number[];
}

export const handler = async (event: S3Event | any) => {
  console.log('Event received:', JSON.stringify(event, null, 2));

  try {
    // Handle S3 trigger (manifest.json upload)
    if (event.Records && event.Records[0]?.s3) {
      const bucket = event.Records[0].s3.bucket.name;
      const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
      
      console.log(`Processing manifest from s3://${bucket}/${key}`);
      
      // Get manifest
      const manifestResponse = await s3.send(new GetObjectCommand({
        Bucket: bucket,
        Key: key
      }));
      
      const manifestContent = await manifestResponse.Body!.transformToString();
      const manifest: ChapterManifest = JSON.parse(manifestContent);
      
      // Process the chapter
      await processChapter(manifest, bucket, key.substring(0, key.lastIndexOf('/')));
      
      return { statusCode: 200, body: 'Processing complete' };
    }
    
    // Handle API Gateway trigger (manual processing)
    if (event.httpMethod) {
      const body = JSON.parse(event.body || '{}');
      
      if (event.httpMethod === 'POST' && event.path === '/learning-modules/process') {
        const { s3Path } = body;
        // Parse s3://bucket/path/to/manifest.json
        const match = s3Path.match(/s3:\/\/([^\/]+)\/(.+)/);
        if (!match) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid S3 path format' })
          };
        }
        
        const [, bucket, key] = match;
        const manifestResponse = await s3.send(new GetObjectCommand({
          Bucket: bucket,
          Key: key
        }));
        
        const manifestContent = await manifestResponse.Body!.transformToString();
        const manifest: ChapterManifest = JSON.parse(manifestContent);
        
        await processChapter(manifest, bucket, key.substring(0, key.lastIndexOf('/')));
        
        return {
          statusCode: 200,
          body: JSON.stringify({ status: 'Processing started', chapter: manifest.chapter })
        };
      }
      
      if (event.httpMethod === 'GET' && event.pathParameters?.moduleId) {
        // Retrieve module data
        const moduleData = await getModuleData(event.pathParameters.moduleId);
        return {
          statusCode: 200,
          body: JSON.stringify(moduleData)
        };
      }
    }
    
    return { statusCode: 400, body: 'Invalid request' };
    
  } catch (error) {
    console.error('Error processing:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Processing failed', details: error.message })
    };
  }
};

async function processChapter(manifest: ChapterManifest, bucket: string, prefix: string) {
  console.log(`Processing chapter ${manifest.chapter} with ${manifest.totalPages} pages`);
  
  const apiKey = await getAnthropicApiKey();
  const anthropic = new Anthropic({ apiKey });
  
  // Get all image files
  const imageContents: { page: number; base64: string; filename: string }[] = [];
  
  for (const filename of manifest.files) {
    if (filename.endsWith('.json')) continue;
    
    const imageResponse = await s3.send(new GetObjectCommand({
      Bucket: bucket,
      Key: `${prefix}/${filename}`
    }));
    
    const imageBuffer = await imageResponse.Body!.transformToByteArray();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    
    // Extract page number from filename (e.g., "peace_corps_fiji_ch02_5_p037_telling_time.jpg")
    const pageMatch = filename.match(/_p(\d+)_/);
    const pageNum = pageMatch ? parseInt(pageMatch[1]) : 0;
    
    imageContents.push({
      page: pageNum,
      base64: base64Image,
      filename
    });
  }
  
  // Sort by page number
  imageContents.sort((a, b) => a.page - b.page);
  
  // Process all pages together with Claude
  const extraction = await extractChapterContent(anthropic, imageContents, manifest);
  
  // Store in DynamoDB
  await storeChapterData(extraction, manifest);
  
  // Create embeddings and index to OpenSearch
  await indexChapterContent(extraction);
  
  console.log(`Processing complete for chapter ${manifest.chapter}`);
}

async function extractChapterContent(
  anthropic: Anthropic,
  images: { page: number; base64: string; filename: string }[],
  manifest: ChapterManifest
): Promise<ChapterExtraction> {
  
  const imageMessages = images.map(img => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/jpeg' as const,
      data: img.base64
    }
  }));
  
  const prompt = `
You are analyzing pages from a Fijian language learning manual (Peace Corps).
Chapter: ${manifest.chapter}
Topic: ${manifest.topic}
Total pages: ${manifest.totalPages}

Extract all learning content and format as JSON with this exact structure:

{
  "chapterMetadata": {
    "lesson": "${manifest.chapter}",
    "title": "Main Fijian title from the pages",
    "subtitle": "English subtitle if present",
    "pageRange": "first-last page numbers",
    "source": "Peace Corps Fiji",
    "totalPages": ${manifest.totalPages},
    "learningObjectives": ["objective 1", "objective 2", ...],
    "prerequisiteLessons": ["2.4", "2.3"] // if mentioned
  },
  "translationPairs": {
    "category_name": [
      {
        "fijian": "Fijian word/phrase",
        "english": "English translation",
        "type": "noun/verb/phrase/etc",
        "page": page_number,
        "usageNotes": "optional context",
        "pronunciation": "if provided",
        "verified": true,
        "source": "peace_corps_manual"
      }
    ]
  },
  "grammarRules": [
    {
      "concept": "Grammar concept name",
      "explanation": "How it works",
      "pattern": "Pattern formula if applicable",
      "examples": [
        {
          "fijian": "example",
          "english": "translation",
          "breakdown": "optional grammatical breakdown"
        }
      ],
      "page": page_number
    }
  ],
  "exercises": [
    {
      "type": "listening/fill_in_blank/practice/etc",
      "instruction": "What students should do",
      "content": "Exercise details",
      "page": page_number
    }
  ],
  "culturalNotes": [
    {
      "note": "Cultural information",
      "pages": [page_numbers]
    }
  ],
  "dialogues": [
    {
      "id": "2.5.1",
      "topic": "Conversation topic",
      "participants": ["A", "B"],
      "page": page_number
    }
  ],
  "visualAids": [
    {
      "type": "clock_faces/images/charts",
      "description": "What it shows",
      "pages": [page_numbers]
    }
  ]
}

Important:
- Extract ALL vocabulary and translations you can see
- Group vocabulary by logical categories (numbers, time expressions, days, months, etc.)
- Include page numbers for everything
- Mark all translations as verified: true
- Note any grammar patterns or rules explained
- Capture exercise instructions and cultural notes
- Be thorough - this will be used to teach students`;

  const message = await anthropic.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 8000,
    temperature: 0.1,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...imageMessages
        ]
      }
    ]
  });
  
  const responseText = message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');
  
  console.log('Claude extraction complete, parsing JSON...');
  
  try {
    return JSON.parse(responseText);
  } catch (error) {
    console.error('Failed to parse Claude response:', responseText);
    throw new Error('Failed to parse extraction results');
  }
}

async function storeChapterData(extraction: ChapterExtraction, manifest: ChapterManifest) {
  const moduleId = `ch${manifest.chapter}`;
  const timestamp = new Date().toISOString();
  
  // Store main module metadata
  await ddb.send(new PutItemCommand({
    TableName: LEARNING_MODULES_TABLE,
    Item: marshall({
      moduleId,
      contentType: 'metadata',
      chapter: manifest.chapter.split('.')[0],
      lessonNumber: parseFloat(manifest.chapter),
      ...extraction.chapterMetadata,
      manifest,
      createdAt: timestamp,
      status: 'processed'
    })
  }));
  
  // Store vocabulary in batches
  const vocabItems: any[] = [];
  let vocabCount = 0;
  
  for (const [category, items] of Object.entries(extraction.translationPairs)) {
    for (const item of items) {
      const vocabId = `${moduleId}_vocab_${++vocabCount}`;
      
      vocabItems.push({
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
      
      // Also add to verified translations table
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
      
      // Add to verified vocab if single word
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
  
  // Batch write vocabulary (DynamoDB limit: 25 items per batch)
  for (let i = 0; i < vocabItems.length; i += 25) {
    const batch = vocabItems.slice(i, i + 25);
    await ddb.send(new BatchWriteItemCommand({
      RequestItems: {
        [MODULE_VOCABULARY_TABLE]: batch
      }
    }));
  }
  
  // Store grammar rules
  if (extraction.grammarRules.length > 0) {
    await ddb.send(new PutItemCommand({
      TableName: LEARNING_MODULES_TABLE,
      Item: marshall({
        moduleId,
        contentType: 'grammar',
        rules: extraction.grammarRules,
        createdAt: timestamp
      })
    }));
  }
  
  // Store exercises
  if (extraction.exercises.length > 0) {
    await ddb.send(new PutItemCommand({
      TableName: LEARNING_MODULES_TABLE,
      Item: marshall({
        moduleId,
        contentType: 'exercises',
        exercises: extraction.exercises,
        createdAt: timestamp
      })
    }));
  }
  
  // Store cultural notes
  if (extraction.culturalNotes.length > 0) {
    await ddb.send(new PutItemCommand({
      TableName: LEARNING_MODULES_TABLE,
      Item: marshall({
        moduleId,
        contentType: 'cultural',
        notes: extraction.culturalNotes,
        createdAt: timestamp
      })
    }));
  }
  
  console.log(`Stored ${vocabCount} vocabulary items for module ${moduleId}`);
}

async function indexChapterContent(extraction: ChapterExtraction) {
  const indexPromises: Promise<any>[] = [];
  
  // Index each vocabulary item with embeddings
  for (const [category, items] of Object.entries(extraction.translationPairs)) {
    for (const item of items) {
      const contextString = `
        Fijian: "${item.fijian}"
        English: "${item.english}"
        Type: ${item.type}
        Category: ${category}
        Usage: ${item.usageNotes || 'general'}
        Lesson: ${extraction.chapterMetadata.title}
      `.trim();
      
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
  
  // Index grammar rules
  for (const rule of extraction.grammarRules) {
    const ruleContext = `
      Grammar concept: ${rule.concept}
      Explanation: ${rule.explanation}
      Pattern: ${rule.pattern || 'N/A'}
      Examples: ${rule.examples.map(e => `${e.fijian} = ${e.english}`).join('; ')}
    `.trim();
    
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
  console.log(`Indexed ${indexPromises.length} items to OpenSearch`);
}

async function getModuleData(moduleId: string) {
  // Retrieve module data from DynamoDB
  // Implementation depends on what data you want to return
  return {
    moduleId,
    status: 'not_implemented_yet'
  };
}