#!/usr/bin/env node

/**
 * Deploy Fijian Dictionary Script
 * 
 * This script:
 * 1. Downloads the Fijian dictionary file if not present
 * 2. Parses the dictionary entries 
 * 3. Populates the DynamoDB DictionaryTable
 * 4. Provides verification and testing
 * 
 * Usage:
 *   npm run deploy-dictionary
 *   DICTIONARY_TABLE=MyTable node scripts/deploy-dictionary.js
 */

import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { ingestDictionary } from './simple-dict-parser.js';
import fs from 'fs';
import https from 'https';
import path from 'path';

const ddbClient = new DynamoDBClient({});

// Configuration
const DICTIONARY_URL = 'https://github.com/user-attachments/files/22055894/fijian-dict-preprocessed-easy.txt';
const LOCAL_DICT_PATH = '/tmp/fijian-dict-preprocessed-easy.txt';
const DEFAULT_TABLE_NAME = 'FijianRagAppStack-DictionaryTable';

/**
 * Download dictionary file if not present
 */
async function ensureDictionaryFile(filePath) {
  if (fs.existsSync(filePath)) {
    console.log(`✓ Dictionary file already exists: ${filePath}`);
    const stats = fs.statSync(filePath);
    console.log(`  Size: ${Math.round(stats.size / 1024)}KB`);
    return;
  }
  
  console.log(`Downloading dictionary file from GitHub...`);
  console.log(`URL: ${DICTIONARY_URL}`);
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    
    https.get(DICTIONARY_URL, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        const stats = fs.statSync(filePath);
        console.log(`✓ Downloaded dictionary file: ${Math.round(stats.size / 1024)}KB`);
        resolve();
      });
      
      file.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Verify DynamoDB table exists and get its name
 */
async function verifyDynamoDBTable(tableName) {
  console.log(`Verifying DynamoDB table: ${tableName}`);
  
  try {
    const result = await ddbClient.send(new DescribeTableCommand({
      TableName: tableName
    }));
    
    console.log(`✓ Table exists: ${result.Table.TableName}`);
    console.log(`  Status: ${result.Table.TableStatus}`);
    console.log(`  Item count: ${result.Table.ItemCount || 0}`);
    
    // Verify table schema
    const keySchema = result.Table.KeySchema || [];
    const partitionKey = keySchema.find(k => k.KeyType === 'HASH');
    const sortKey = keySchema.find(k => k.KeyType === 'RANGE');
    
    if (partitionKey?.AttributeName !== 'word' || sortKey?.AttributeName !== 'language') {
      throw new Error(`Table schema mismatch. Expected partition key 'word' and sort key 'language', found: ${partitionKey?.AttributeName}, ${sortKey?.AttributeName}`);
    }
    
    console.log(`✓ Table schema correct: word (HASH), language (RANGE)`);
    return tableName;
    
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.error(`❌ Table '${tableName}' not found`);
      console.log('\nAvailable options:');
      console.log('1. Deploy the CDK stack first: npm run cdk:deploy');
      console.log('2. Use a different table name: DICTIONARY_TABLE=YourTable node scripts/deploy-dictionary.js');
    }
    throw error;
  }
}

/**
 * Main deployment function
 */
async function deployDictionary() {
  console.log('=== Fijian Dictionary Deployment ===\n');
  
  try {
    // Get table name from environment or use default
    const tableName = process.env.DICTIONARY_TABLE || DEFAULT_TABLE_NAME;
    
    // Step 1: Verify DynamoDB table
    await verifyDynamoDBTable(tableName);
    
    // Step 2: Ensure dictionary file is available
    await ensureDictionaryFile(LOCAL_DICT_PATH);
    
    // Step 3: Parse and ingest dictionary
    console.log('\nStarting dictionary ingestion...');
    const result = await ingestDictionary(LOCAL_DICT_PATH, tableName);
    
    // Step 4: Report results
    console.log('\n=== Deployment Summary ===');
    console.log(`Dictionary entries processed: ${result.processed}`);
    console.log(`Errors: ${result.errors}`);
    console.log(`Success rate: ${((result.processed / (result.processed + result.errors)) * 100).toFixed(1)}%`);
    
    if (result.errors > 0) {
      console.log('\n⚠️  Some entries failed to write. This is normal for duplicate keys or malformed entries.');
    }
    
    console.log('\n=== Next Steps ===');
    console.log('1. Test the VocabularyProcessingLambda with Fijian article URLs');
    console.log('2. Verify that vocabulary records now include dictionary translations');
    console.log('3. Check VocabularyFrequencyTable for populated definition fields');
    
    console.log('\n✅ Dictionary deployment completed successfully!');
    
    return result;
    
  } catch (error) {
    console.error('\n❌ Dictionary deployment failed:');
    console.error(`Error: ${error.message}`);
    
    if (error.code === 'ENOTFOUND') {
      console.log('\nNetwork issue detected. Try:');
      console.log('1. Check internet connection');
      console.log('2. Download dictionary file manually and place at /tmp/fijian-dict-preprocessed-easy.txt');
    } else if (error.code === 'NoCredentialsError' || error.code === 'CredentialsError') {
      console.log('\nAWS credentials issue detected. Try:');
      console.log('1. aws configure');
      console.log('2. Set AWS_PROFILE environment variable');
      console.log('3. Ensure AWS credentials are configured');
    }
    
    throw error;
  }
}

/**
 * Dry run mode - parse only, don't write to DynamoDB
 */
async function dryRun() {
  console.log('=== Dictionary Dry Run (Parse Only) ===\n');
  
  await ensureDictionaryFile(LOCAL_DICT_PATH);
  
  // Import parser functions
  const { parseDictionary } = await import('./simple-dict-parser.js');
  const content = fs.readFileSync(LOCAL_DICT_PATH, 'utf8');
  const entries = parseDictionary(content);
  
  console.log(`\nParsed ${entries.length} entries successfully`);
  console.log('\nSample entries:');
  entries.slice(0, 10).forEach((entry, i) => {
    console.log(`${i + 1}. "${entry.word}" (${entry.part_of_speech}) -> "${entry.english_translation.substring(0, 50)}..."`);
  });
  
  console.log('\n✅ Dry run completed - no data written to DynamoDB');
}

// CLI handling
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

if (import.meta.url === `file://${process.argv[1]}`) {
  if (isDryRun) {
    dryRun().catch(error => {
      console.error('Dry run failed:', error.message);
      process.exit(1);
    });
  } else {
    deployDictionary().catch(error => {
      console.error('Deployment failed:', error.message);
      process.exit(1);
    });
  }
}