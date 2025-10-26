/**
 * Bronze to Silver ETL Lambda
 * 
 * Processes raw data from Bronze layer and transforms it into standardized
 * Parquet format in the Silver layer following the Medallion architecture.
 * 
 * Responsibilities:
 * - Load raw data from Bronze S3 bucket
 * - Validate and parse data
 * - Apply transformations (normalize, deduplicate, typecast)
 * - Validate against schema contract
 * - Write Parquet files to Silver layer with partitioning
 * - Log metrics and data quality checks
 */

import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Handler, S3Event } from 'aws-lambda';

const s3Client = new S3Client({});

interface BronzeMetadata {
  source: string;
  ingestion_ts: string;
  file_hash: string;
  record_count: number;
  run_id: string;
  schema_version?: string;
}

interface DictionaryEntry {
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

interface ProcessingMetrics {
  total_records: number;
  valid_records: number;
  invalid_records: number;
  duplicate_records: number;
  processing_time_ms: number;
  errors: string[];
}

/**
 * Main Lambda handler for Bronze to Silver ETL
 */
export const handler: Handler<S3Event, void> = async (event) => {
  console.log('Bronze to Silver ETL started', { event });
  
  const startTime = Date.now();
  const metrics: ProcessingMetrics = {
    total_records: 0,
    valid_records: 0,
    invalid_records: 0,
    duplicate_records: 0,
    processing_time_ms: 0,
    errors: [],
  };

  try {
    for (const record of event.Records) {
      const bucketName = record.s3.bucket.name;
      const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

      console.log(`Processing Bronze object: s3://${bucketName}/${objectKey}`);

      // Only process JSON files (raw data), skip metadata files
      if (!objectKey.endsWith('.json') || objectKey.includes('metadata')) {
        console.log(`Skipping non-data file: ${objectKey}`);
        continue;
      }

      // Load raw data from Bronze
      const rawData = await loadBronzeData(bucketName, objectKey);
      
      // Load metadata if exists
      const metadata = await loadBronzeMetadata(bucketName, objectKey);

      // Transform Bronze to Silver
      const silverData = await transformToSilver(rawData, metadata);
      
      // Update metrics
      metrics.total_records += rawData.length;
      metrics.valid_records += silverData.length;
      metrics.invalid_records += rawData.length - silverData.length;

      // Write to Silver layer
      await writeSilverData(silverData, metadata);

      console.log(`Processed ${silverData.length} records from ${objectKey}`);
    }

    metrics.processing_time_ms = Date.now() - startTime;

    // Log final metrics
    console.log('Bronze to Silver ETL completed', { metrics });

    // Write processing metrics
    await writeProcessingMetrics(metrics);

  } catch (error) {
    console.error('Bronze to Silver ETL failed', { error });
    metrics.errors.push(error instanceof Error ? error.message : String(error));
    throw error;
  }
};

/**
 * Load raw data from Bronze layer
 */
async function loadBronzeData(bucket: string, key: string): Promise<any[]> {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );

    const bodyString = await response.Body?.transformToString();
    if (!bodyString) {
      throw new Error('Empty response body');
    }

    const data = JSON.parse(bodyString);
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    console.error(`Failed to load Bronze data from ${key}`, { error });
    throw error;
  }
}

/**
 * Load metadata from Bronze layer
 */
async function loadBronzeMetadata(bucket: string, dataKey: string): Promise<BronzeMetadata | null> {
  try {
    // Metadata file is in the same directory as the data file
    const metadataKey = dataKey.replace(/[^/]+\.json$/, 'metadata.json');
    
    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: metadataKey })
    );

    const bodyString = await response.Body?.transformToString();
    if (!bodyString) {
      console.warn(`No metadata found for ${dataKey}`);
      return null;
    }

    return JSON.parse(bodyString) as BronzeMetadata;
  } catch (error) {
    console.warn(`Could not load metadata for ${dataKey}`, { error });
    return null;
  }
}

/**
 * Transform Bronze data to Silver format
 */
async function transformToSilver(rawData: any[], metadata: BronzeMetadata | null): Promise<DictionaryEntry[]> {
  const silverEntries: DictionaryEntry[] = [];
  const seen = new Set<string>(); // For deduplication

  for (const rawEntry of rawData) {
    try {
      // Apply transformations
      const entry = applyTransformations(rawEntry);

      // Validate entry
      if (!validateEntry(entry)) {
        console.warn('Invalid entry skipped', { entry });
        continue;
      }

      // Deduplicate
      const dedupeKey = `${entry.fijian_word}:${entry.english_translation}`;
      if (seen.has(dedupeKey)) {
        console.warn('Duplicate entry skipped', { entry });
        continue;
      }
      seen.add(dedupeKey);

      silverEntries.push(entry);
    } catch (error) {
      console.error('Failed to transform entry', { rawEntry, error });
    }
  }

  return silverEntries;
}

/**
 * Apply transformations to raw data
 */
function applyTransformations(rawEntry: any): DictionaryEntry {
  const now = new Date().toISOString();

  return {
    entry_id: rawEntry.entry_id || rawEntry.id || generateEntryId(rawEntry),
    fijian_word: normalizeUnicode(rawEntry.fijian_word || rawEntry.fijian || rawEntry.word || '').trim(),
    english_translation: (rawEntry.english_translation || rawEntry.english || rawEntry.meaning || '').trim(),
    pronunciation: rawEntry.pronunciation?.trim() || undefined,
    part_of_speech: normalizePartOfSpeech(rawEntry.part_of_speech || rawEntry.pos),
    usage_examples: normalizeExamples(rawEntry.usage_examples || rawEntry.examples),
    alternate_translations: rawEntry.alternate_translations || rawEntry.alternates,
    cultural_notes: rawEntry.cultural_notes?.trim() || undefined,
    difficulty_level: normalizeDifficultyLevel(rawEntry.difficulty_level || rawEntry.difficulty),
    frequency_rank: parseIntOrUndefined(rawEntry.frequency_rank),
    source_reference: rawEntry.source_reference || rawEntry.source || undefined,
    verified: Boolean(rawEntry.verified),
    updated_at: rawEntry.updated_at || now,
    created_at: rawEntry.created_at || now,
  };
}

/**
 * Normalize Unicode text (NFC normalization)
 */
function normalizeUnicode(text: string): string {
  return text.normalize('NFC');
}

/**
 * Normalize part of speech values
 */
function normalizePartOfSpeech(pos: any): string | undefined {
  if (!pos) return undefined;
  
  const normalized = String(pos).toLowerCase().trim();
  const validValues = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'phrase'];
  
  return validValues.includes(normalized) ? normalized : undefined;
}

/**
 * Normalize usage examples
 */
function normalizeExamples(examples: any): Array<{ fijian: string; english: string }> | undefined {
  if (!examples || !Array.isArray(examples)) return undefined;
  
  return examples
    .filter(ex => ex && typeof ex === 'object' && ex.fijian && ex.english)
    .map(ex => ({
      fijian: normalizeUnicode(ex.fijian.trim()),
      english: ex.english.trim(),
    }));
}

/**
 * Normalize difficulty level
 */
function normalizeDifficultyLevel(level: any): string | undefined {
  if (!level) return undefined;
  
  const normalized = String(level).toLowerCase().trim();
  const validValues = ['beginner', 'intermediate', 'advanced'];
  
  return validValues.includes(normalized) ? normalized : undefined;
}

/**
 * Parse integer or return undefined
 */
function parseIntOrUndefined(value: any): number | undefined {
  const parsed = parseInt(value);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Generate entry ID from Fijian word
 */
function generateEntryId(entry: any): string {
  const word = entry.fijian_word || entry.fijian || entry.word || 'unknown';
  const timestamp = Date.now();
  return `${word.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}`;
}

/**
 * Validate dictionary entry
 */
function validateEntry(entry: DictionaryEntry): boolean {
  // Required fields
  if (!entry.fijian_word || !entry.english_translation) {
    return false;
  }

  // Basic sanity checks
  if (entry.fijian_word.length < 1 || entry.fijian_word.length > 200) {
    return false;
  }

  if (entry.english_translation.length < 1 || entry.english_translation.length > 500) {
    return false;
  }

  return true;
}

/**
 * Write Silver data to S3 with partitioning
 */
async function writeSilverData(entries: DictionaryEntry[], metadata: BronzeMetadata | null): Promise<void> {
  if (entries.length === 0) {
    console.log('No entries to write to Silver layer');
    return;
  }

  const silverBucket = process.env.SILVER_BUCKET_NAME;
  if (!silverBucket) {
    throw new Error('SILVER_BUCKET_NAME environment variable not set');
  }

  // Partition by year/month
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  // Generate unique file name
  const runId = metadata?.run_id || Date.now().toString();
  const fileName = `part-${runId}.json`; // Using JSON for simplicity, would be Parquet in production

  const key = `dictionary_entries/year=${year}/month=${month}/${fileName}`;

  console.log(`Writing ${entries.length} entries to Silver layer: s3://${silverBucket}/${key}`);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: silverBucket,
      Key: key,
      Body: JSON.stringify(entries, null, 2),
      ContentType: 'application/json',
      Metadata: {
        record_count: entries.length.toString(),
        source: metadata?.source || 'unknown',
        processing_timestamp: new Date().toISOString(),
      },
    })
  );

  console.log(`Successfully wrote ${entries.length} entries to Silver layer`);
}

/**
 * Write processing metrics to S3
 */
async function writeProcessingMetrics(metrics: ProcessingMetrics): Promise<void> {
  const silverBucket = process.env.SILVER_BUCKET_NAME;
  if (!silverBucket) {
    console.warn('SILVER_BUCKET_NAME not set, skipping metrics write');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `_metrics/bronze-to-silver/${timestamp}.json`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: silverBucket,
      Key: key,
      Body: JSON.stringify(metrics, null, 2),
      ContentType: 'application/json',
    })
  );
}
