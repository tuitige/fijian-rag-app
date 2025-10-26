#!/usr/bin/env node
/**
 * Sample Data Ingestion Script
 * 
 * Demonstrates ingesting sample Fijian dictionary data into the Bronze layer
 * of the Medallion architecture data pipeline.
 * 
 * Usage:
 *   node scripts/ingest-sample-data.js [--bronze-bucket BUCKET_NAME]
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

const s3Client = new S3Client({});

// Sample Fijian dictionary entries (similar to Synthea concept but for language learning)
const sampleDictionaryEntries = [
  {
    fijian_word: 'bula',
    english_translation: 'hello, life, health',
    pronunciation: 'mbula',
    part_of_speech: 'noun',
    usage_examples: [
      {
        fijian: 'Bula vinaka!',
        english: 'Hello! (formal greeting)'
      },
      {
        fijian: 'Ni sa bula',
        english: 'Hello (casual)'
      }
    ],
    alternate_translations: ['greetings', 'wellness'],
    cultural_notes: 'The most important word in Fijian. Used as a greeting, it literally means "life" and embodies the Fijian spirit of warmth and hospitality.',
    difficulty_level: 'beginner',
    frequency_rank: 1,
    verified: true,
  },
  {
    fijian_word: 'vinaka',
    english_translation: 'thank you',
    pronunciation: 'vinaka',
    part_of_speech: 'adjective',
    usage_examples: [
      {
        fijian: 'Vinaka vaka levu',
        english: 'Thank you very much'
      },
      {
        fijian: 'Vinaka sara',
        english: 'Many thanks'
      }
    ],
    alternate_translations: ['good', 'fine'],
    cultural_notes: 'Essential word for expressing gratitude. Also means "good" or "fine".',
    difficulty_level: 'beginner',
    frequency_rank: 2,
    verified: true,
  },
  {
    fijian_word: 'moce',
    english_translation: 'goodbye, sleep',
    pronunciation: 'mothe',
    part_of_speech: 'verb',
    usage_examples: [
      {
        fijian: 'Ni sa moce',
        english: 'Goodbye / Goodnight'
      }
    ],
    alternate_translations: ['farewell', 'sleep'],
    difficulty_level: 'beginner',
    frequency_rank: 3,
    verified: true,
  },
  {
    fijian_word: 'yalo',
    english_translation: 'soul, spirit',
    pronunciation: 'yalo',
    part_of_speech: 'noun',
    usage_examples: [
      {
        fijian: 'Na yalo ni tamata',
        english: 'The spirit of the person'
      }
    ],
    cultural_notes: 'Important spiritual concept in Fijian culture.',
    difficulty_level: 'intermediate',
    frequency_rank: 50,
    verified: true,
  },
  {
    fijian_word: 'vanua',
    english_translation: 'land, place, people',
    pronunciation: 'vanua',
    part_of_speech: 'noun',
    usage_examples: [
      {
        fijian: 'Na vanua ko Viti',
        english: 'The land of Fiji'
      }
    ],
    cultural_notes: 'Central concept in Fijian culture representing land, people, and customs as an integrated whole.',
    difficulty_level: 'intermediate',
    frequency_rank: 25,
    verified: true,
  },
];

/**
 * Generate metadata for Bronze ingestion
 */
function generateMetadata(dataArray) {
  const now = new Date().toISOString();
  const runId = crypto.randomUUID();
  const dataString = JSON.stringify(dataArray);
  const fileHash = crypto.createHash('sha256').update(dataString).digest('hex');

  return {
    source: 'sample_data_script',
    ingestion_ts: now,
    file_hash: fileHash,
    record_count: dataArray.length,
    run_id: runId,
    schema_version: '1.0',
    file_size_bytes: Buffer.byteLength(dataString),
  };
}

/**
 * Upload data to Bronze layer
 */
async function uploadToBronze(bronzeBucket) {
  const metadata = generateMetadata(sampleDictionaryEntries);
  const loadDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Upload data file
  const dataKey = `dictionaries/manual/load_dt=${loadDate}/run_id=${metadata.run_id}/entries.json`;
  console.log(`Uploading data to s3://${bronzeBucket}/${dataKey}`);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bronzeBucket,
      Key: dataKey,
      Body: JSON.stringify(sampleDictionaryEntries, null, 2),
      ContentType: 'application/json',
      Metadata: {
        source: metadata.source,
        ingestion_ts: metadata.ingestion_ts,
        record_count: metadata.record_count.toString(),
        run_id: metadata.run_id,
      },
    })
  );

  console.log('✅ Data uploaded successfully');

  // Upload metadata file
  const metadataKey = `dictionaries/manual/load_dt=${loadDate}/run_id=${metadata.run_id}/metadata.json`;
  console.log(`Uploading metadata to s3://${bronzeBucket}/${metadataKey}`);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bronzeBucket,
      Key: metadataKey,
      Body: JSON.stringify(metadata, null, 2),
      ContentType: 'application/json',
    })
  );

  console.log('✅ Metadata uploaded successfully');
  console.log('\nIngestion Summary:');
  console.log(`  Records: ${metadata.record_count}`);
  console.log(`  Run ID: ${metadata.run_id}`);
  console.log(`  File Hash: ${metadata.file_hash}`);
  console.log('\nThe Bronze to Silver ETL Lambda should be triggered automatically by S3 event notification.');
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let bronzeBucket = null;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bronze-bucket' && i + 1 < args.length) {
      bronzeBucket = args[i + 1];
      i++;
    }
  }

  if (!bronzeBucket) {
    console.error('Error: Bronze bucket name is required');
    console.error('Usage: node scripts/ingest-sample-data.js --bronze-bucket BUCKET_NAME');
    console.error('\nGet the bucket name from CDK outputs:');
    console.error('  cd infrastructure/cdk && npx cdk deploy --outputs-file ../../cdk-outputs.json');
    console.error('  cat ../../cdk-outputs.json | grep BronzeBucketName');
    process.exit(1);
  }

  console.log('=== Fijian RAG App - Sample Data Ingestion ===\n');
  console.log(`Target Bronze Bucket: ${bronzeBucket}\n`);

  try {
    await uploadToBronze(bronzeBucket);
    console.log('\n✅ Sample data ingestion completed successfully!');
  } catch (error) {
    console.error('\n❌ Error during ingestion:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { sampleDictionaryEntries, generateMetadata, uploadToBronze };
