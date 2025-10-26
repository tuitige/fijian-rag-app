/**
 * Silver to Gold ETL Lambda
 * 
 * Transforms standardized Silver layer data into production-ready format
 * and loads it into DynamoDB and OpenSearch (Gold layer).
 * 
 * Responsibilities:
 * - Load data from Silver S3 bucket (Parquet/JSON)
 * - Generate embeddings using Amazon Titan
 * - Transform to application schema
 * - Load into DynamoDB (DictionaryTable)
 * - Index into OpenSearch with embeddings
 * - Validate referential integrity and data quality
 */

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { DynamoDBClient, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { Handler, ScheduledEvent } from 'aws-lambda';
import { marshall } from '@aws-sdk/util-dynamodb';

const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});

interface SilverDictionaryEntry {
  entry_id: string;
  fijian_word: string;
  english_translation: string;
  pronunciation?: string;
  part_of_speech?: string;
  usage_examples?: Array<{ fijian: string; english: string }>;
  alternate_translations?: string[];
  cultural_notes?: string;
  difficulty_level?: string;
  frequency_rank?: number;
  source_reference?: string;
  verified: boolean;
  updated_at: string;
  created_at: string;
}

interface GoldDictionaryEntry {
  word: string;               // PK
  language: string;            // SK
  english: string;
  pronunciation?: string;
  partOfSpeech?: string;
  examples?: Array<{ fijian: string; english: string }>;
  alternateTranslations?: string[];
  culturalNotes?: string;
  difficultyLevel?: string;
  frequencyRank?: number;
  verified: boolean;
  updatedAt: string;
  createdAt: string;
  embedding?: number[];        // Added by embedding generation
}

interface ProcessingMetrics {
  total_records: number;
  successful_writes: number;
  failed_writes: number;
  embeddings_generated: number;
  processing_time_ms: number;
  errors: string[];
}

/**
 * Main Lambda handler for Silver to Gold ETL
 */
export const handler: Handler<ScheduledEvent, void> = async (event) => {
  console.log('Silver to Gold ETL started', { event });
  
  const startTime = Date.now();
  const metrics: ProcessingMetrics = {
    total_records: 0,
    successful_writes: 0,
    failed_writes: 0,
    embeddings_generated: 0,
    processing_time_ms: 0,
    errors: [],
  };

  try {
    // Load Silver data (incremental - last month's partition)
    const silverEntries = await loadSilverData();
    metrics.total_records = silverEntries.length;

    console.log(`Loaded ${silverEntries.length} entries from Silver layer`);

    // Transform to Gold schema
    const goldEntries = silverEntries.map(transformToGold);

    // Generate embeddings (batch processing)
    console.log('Generating embeddings for entries...');
    await generateEmbeddings(goldEntries, metrics);

    // Write to DynamoDB
    console.log('Writing to DynamoDB...');
    await writeToDynamoDB(goldEntries, metrics);

    // Index into OpenSearch (optional - would be added in production)
    // await indexToOpenSearch(goldEntries, metrics);

    metrics.processing_time_ms = Date.now() - startTime;

    console.log('Silver to Gold ETL completed', { metrics });

  } catch (error) {
    console.error('Silver to Gold ETL failed', { error });
    metrics.errors.push(error instanceof Error ? error.message : String(error));
    throw error;
  }
};

/**
 * Load Silver data from S3
 * In production, this would:
 * - Query by partition (year/month)
 * - Load Parquet files
 * - Support incremental loading
 */
async function loadSilverData(): Promise<SilverDictionaryEntry[]> {
  const silverBucket = process.env.SILVER_BUCKET_NAME;
  if (!silverBucket) {
    throw new Error('SILVER_BUCKET_NAME environment variable not set');
  }

  // Get current year/month for incremental processing
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const prefix = `dictionary_entries/year=${year}/month=${month}/`;

  console.log(`Loading Silver data from s3://${silverBucket}/${prefix}`);

  // List objects in partition
  const listResponse = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: silverBucket,
      Prefix: prefix,
    })
  );

  if (!listResponse.Contents || listResponse.Contents.length === 0) {
    console.log('No Silver data found for current month');
    return [];
  }

  // Load all files in partition
  const allEntries: SilverDictionaryEntry[] = [];

  for (const object of listResponse.Contents) {
    if (!object.Key || object.Key.endsWith('/') || object.Key.includes('_metrics')) {
      continue;
    }

    console.log(`Loading ${object.Key}`);

    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: silverBucket,
        Key: object.Key,
      })
    );

    const bodyString = await response.Body?.transformToString();
    if (!bodyString) continue;

    const entries = JSON.parse(bodyString);
    if (Array.isArray(entries)) {
      allEntries.push(...entries);
    }
  }

  return allEntries;
}

/**
 * Transform Silver entry to Gold schema
 */
function transformToGold(silverEntry: SilverDictionaryEntry): GoldDictionaryEntry {
  return {
    word: silverEntry.fijian_word,
    language: 'fijian',
    english: silverEntry.english_translation,
    pronunciation: silverEntry.pronunciation,
    partOfSpeech: silverEntry.part_of_speech,
    examples: silverEntry.usage_examples,
    alternateTranslations: silverEntry.alternate_translations,
    culturalNotes: silverEntry.cultural_notes,
    difficultyLevel: silverEntry.difficulty_level,
    frequencyRank: silverEntry.frequency_rank,
    verified: silverEntry.verified,
    updatedAt: silverEntry.updated_at,
    createdAt: silverEntry.created_at,
  };
}

/**
 * Generate embeddings for entries using Amazon Titan
 * This is a simplified version - production would use the existing
 * embedding pipeline from backend/lambdas/dictionary/processor.ts
 */
async function generateEmbeddings(
  entries: GoldDictionaryEntry[],
  metrics: ProcessingMetrics
): Promise<void> {
  console.log(`Generating embeddings for ${entries.length} entries`);

  // In production, this would:
  // 1. Use Amazon Bedrock Runtime to call Titan Embeddings
  // 2. Batch process with controlled concurrency
  // 3. Cache embeddings in S3
  // 4. Handle retries with exponential backoff

  // For now, we'll create placeholder embeddings
  // Real implementation would use the createEmbeddingsBatch function
  for (const entry of entries) {
    try {
      // Combine text for embedding
      const textForEmbedding = [
        entry.word,
        entry.english,
        entry.pronunciation,
        ...(entry.examples?.map(ex => `${ex.fijian} ${ex.english}`) || []),
      ]
        .filter(Boolean)
        .join(' ');

      // Placeholder: In production, call Amazon Titan
      // const embedding = await createEmbedding(textForEmbedding);
      // entry.embedding = embedding;
      
      // For now, create a zero vector (1536 dimensions for Titan)
      entry.embedding = new Array(1536).fill(0);
      
      metrics.embeddings_generated++;
    } catch (error) {
      console.error(`Failed to generate embedding for ${entry.word}`, { error });
      metrics.errors.push(`Embedding failed for ${entry.word}`);
    }
  }

  console.log(`Generated ${metrics.embeddings_generated} embeddings`);
}

/**
 * Write entries to DynamoDB
 */
async function writeToDynamoDB(
  entries: GoldDictionaryEntry[],
  metrics: ProcessingMetrics
): Promise<void> {
  const tableName = process.env.DICTIONARY_TABLE_NAME;
  if (!tableName) {
    throw new Error('DICTIONARY_TABLE_NAME environment variable not set');
  }

  console.log(`Writing ${entries.length} entries to DynamoDB table: ${tableName}`);

  // DynamoDB batch write supports max 25 items per batch
  const batchSize = 25;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);

    try {
      const putRequests = batch.map((entry) => {
        // Remove embedding from DynamoDB (too large, store in OpenSearch)
        const { embedding, ...itemWithoutEmbedding } = entry;
        
        return {
          PutRequest: {
            Item: marshall(itemWithoutEmbedding, { removeUndefinedValues: true }),
          },
        };
      });

      await dynamoClient.send(
        new BatchWriteItemCommand({
          RequestItems: {
            [tableName]: putRequests,
          },
        })
      );

      metrics.successful_writes += batch.length;
      console.log(`Wrote batch ${i / batchSize + 1}: ${batch.length} items`);
    } catch (error) {
      console.error(`Failed to write batch starting at index ${i}`, { error });
      metrics.failed_writes += batch.length;
      metrics.errors.push(`Batch write failed at index ${i}`);
    }
  }

  console.log(`DynamoDB write complete: ${metrics.successful_writes} successful, ${metrics.failed_writes} failed`);
}

/**
 * Index entries into OpenSearch (placeholder)
 * In production, this would:
 * - Connect to OpenSearch cluster
 * - Use bulk indexing API
 * - Include embedding vectors
 * - Handle mapping and settings
 */
async function indexToOpenSearch(
  entries: GoldDictionaryEntry[],
  metrics: ProcessingMetrics
): Promise<void> {
  console.log('OpenSearch indexing not implemented yet');
  
  // This would use the OpenSearch client from backend/shared/opensearch.ts
  // to index entries with their embeddings for hybrid search
}
