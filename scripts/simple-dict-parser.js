/**
 * Simple and robust Fijian dictionary parser
 * Parses the fijian-dict-preprocessed-easy.txt file format
 */

import { DynamoDBClient, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import fs from 'fs';

const ddbClient = new DynamoDBClient({});

/**
 * Parse a single dictionary entry line
 */
function parseEntry(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 5) return null;
  
  // Skip page numbers and headers
  if (/^\d+\s*$/.test(trimmed) || 
      trimmed.includes('FIJIAN') || 
      trimmed.includes('DICTIONARY') ||
      trimmed.includes('ENGLISH')) {
    return null;
  }
  
  // Look for pattern: word (optional_info) part_of_speech. definition
  // Examples: 
  // "bula n. life, health, greeting"
  // "agelo (or) yagelo (Eng., Rom. Cath.) n. angel."
  // "ba 1. n. edible stalk of taro"
  
  const entryPattern = /^([a-zA-Z][a-zA-Z\s,\d\(\)]*?)\s+(n\.|v\.|adj\.|adv\.)\s+(.+)/;
  const match = trimmed.match(entryPattern);
  
  if (!match) {
    // Try simpler pattern for entries without clear POS
    const simplePattern = /^([a-zA-Z][a-zA-Z\s,\d\(\)]*?)\s+(.{10,})/;
    const simpleMatch = trimmed.match(simplePattern);
    if (simpleMatch) {
      const wordPart = simpleMatch[1].trim();
      const defPart = simpleMatch[2].trim();
      
      // Skip if definition is too short or contains too many formatting artifacts
      if (defPart.length < 10 || defPart.includes('page') || defPart.includes('FIJIAN')) {
        return null;
      }
      
      return parseWordAndDefinition(wordPart, 'unknown', defPart);
    }
    return null;
  }
  
  const wordPart = match[1].trim();
  const partOfSpeech = match[2].replace('.', '');
  const definition = match[3].trim();
  
  return parseWordAndDefinition(wordPart, partOfSpeech, definition);
}

/**
 * Parse word part and create dictionary entries
 */
function parseWordAndDefinition(wordPart, partOfSpeech, definition) {
  // Clean up the word part
  let cleanWord = wordPart;
  
  // Remove numbering (e.g., "ba 1" -> "ba")
  cleanWord = cleanWord.replace(/\s+\d+\.?\s*$/, '');
  
  // Handle etymology info in parentheses
  let etymology = null;
  const etymMatch = cleanWord.match(/\(([^)]+)\)/);
  if (etymMatch) {
    etymology = etymMatch[1];
    cleanWord = cleanWord.replace(/\s*\([^)]+\)\s*/g, ' ').trim();
  }
  
  // Extract word variants
  const words = [];
  
  if (cleanWord.includes('(or)')) {
    // Handle "word1 (or) word2" pattern
    const parts = cleanWord.split('(or)').map(p => p.trim());
    words.push(...parts);
  } else if (cleanWord.includes(',')) {
    // Handle "word1, word2" pattern
    const parts = cleanWord.split(',').map(p => p.trim());
    words.push(...parts);
  } else {
    words.push(cleanWord);
  }
  
  // Clean and validate words
  const validWords = words
    .map(w => w.toLowerCase().trim())
    .filter(w => w.length >= 2 && w.length <= 30)
    .filter(w => /^[a-zA-Z][a-zA-Z\s]*$/.test(w)) // Only letters and spaces
    .map(w => w.replace(/\s+/g, '')); // Remove internal spaces
  
  if (validWords.length === 0) return null;
  
  // Clean up definition
  let cleanDef = definition;
  // Remove trailing periods and common artifacts
  cleanDef = cleanDef.replace(/\.\s*$/, '');
  // Take first sentence or first 200 characters
  if (cleanDef.includes('. ')) {
    cleanDef = cleanDef.split('. ')[0];
  }
  cleanDef = cleanDef.substring(0, 200).trim();
  
  if (cleanDef.length < 5) return null;
  
  // Create entries for each valid word
  const entries = validWords.map(word => ({
    word: word,
    language: 'fijian',
    english_translation: cleanDef,
    part_of_speech: partOfSpeech,
    ...(etymology && { etymology }),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
  
  return entries;
}

/**
 * Parse dictionary text file line by line
 */
function parseDictionary(content) {
  const lines = content.split('\n');
  const allEntries = [];
  
  console.log(`Processing ${lines.length} lines...`);
  
  let processedLines = 0;
  let successfulEntries = 0;
  
  for (const line of lines) {
    processedLines++;
    
    if (processedLines % 1000 === 0) {
      console.log(`Processed ${processedLines}/${lines.length} lines, found ${successfulEntries} entries`);
    }
    
    try {
      const entries = parseEntry(line);
      if (entries && entries.length > 0) {
        allEntries.push(...entries);
        successfulEntries += entries.length;
      }
    } catch (error) {
      // Skip problematic lines silently
    }
  }
  
  console.log(`Parsing complete: ${successfulEntries} entries from ${processedLines} lines`);
  return allEntries;
}

/**
 * Batch write entries to DynamoDB
 */
async function batchWriteEntries(entries, tableName) {
  const batchSize = 25;
  let processed = 0;
  let errors = 0;
  
  console.log(`Writing ${entries.length} entries to ${tableName} in batches of ${batchSize}...`);
  
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    
    const putRequests = batch.map(entry => ({
      PutRequest: {
        Item: marshall(entry)
      }
    }));
    
    try {
      await ddbClient.send(new BatchWriteItemCommand({
        RequestItems: {
          [tableName]: putRequests
        }
      }));
      
      processed += batch.length;
      
      if (processed % 100 === 0 || processed === entries.length) {
        console.log(`✓ Written ${processed}/${entries.length} entries`);
      }
    } catch (error) {
      console.error(`✗ Error writing batch starting at index ${i}:`, error.message);
      errors += batch.length;
    }
    
    // Small delay to avoid throttling
    if (i + batchSize < entries.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  return { processed, errors };
}

/**
 * Main function
 */
async function ingestDictionary(filePath, tableName) {
  console.log('=== Fijian Dictionary Ingestion ===');
  console.log(`File: ${filePath}`);
  console.log(`Table: ${tableName}`);
  
  // Read file
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`Read ${content.length} characters`);
  
  // Parse entries
  const entries = parseDictionary(content);
  
  if (entries.length === 0) {
    throw new Error('No dictionary entries found');
  }
  
  // Show sample entries
  console.log('\nSample entries:');
  entries.slice(0, 5).forEach((entry, i) => {
    console.log(`${i + 1}. "${entry.word}" (${entry.part_of_speech}) -> "${entry.english_translation}"`);
  });
  
  // Write to DynamoDB
  console.log('\nWriting to DynamoDB...');
  const result = await batchWriteEntries(entries, tableName);
  
  console.log('\n=== Ingestion Complete ===');
  console.log(`Total entries: ${entries.length}`);
  console.log(`Successfully written: ${result.processed}`);
  console.log(`Errors: ${result.errors}`);
  
  return result;
}

// Export for testing
export { parseDictionary, parseEntry, ingestDictionary };

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const filePath = process.argv[2] || '/tmp/fijian-dict-preprocessed-easy.txt';
  const tableName = process.env.DICTIONARY_TABLE || 'DictionaryTable';
  
  ingestDictionary(filePath, tableName)
    .then(result => {
      console.log('\n✅ Dictionary ingestion completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Dictionary ingestion failed:', error.message);
      process.exit(1);
    });
}