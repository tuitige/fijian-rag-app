/**
 * Parse and ingest Fijian dictionary from preprocessed text file
 * This script parses the fijian-dict-preprocessed-easy.txt file and imports entries into DynamoDB
 */

import { DynamoDBClient, PutItemCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import fs from 'fs';
import path from 'path';

const ddbClient = new DynamoDBClient({});

/**
 * Extract part of speech from text
 */
function extractPartOfSpeech(text) {
  const posPatterns = [
    'n\\.', 'noun', 'v\\.', 'verb', 'adj\\.', 'adjective', 
    'adv\\.', 'adverb', 'prep\\.', 'preposition', 'conj\\.', 'conjunction',
    'inter\\.', 'interjection', 'pron\\.', 'pronoun', 'art\\.', 'article',
    'particle', 'num\\.', 'numeral'
  ];
  
  for (const pattern of posPatterns) {
    const regex = new RegExp(`\\b${pattern}\\b`, 'i');
    if (regex.test(text)) {
      return pattern.replace('\\.', '');
    }
  }
  return 'unknown';
}

/**
 * Clean up etymology/source information
 */
function extractEtymology(text) {
  const etymMatch = text.match(/\(([^)]+)\)/);
  if (etymMatch) {
    const etym = etymMatch[1];
    // Remove common non-etymology parenthetical content
    if (etym.includes('Eng.') || etym.includes('Bible') || etym.includes('Slang') || 
        etym.includes('Rom. Cath.') || etym.includes('Prot.') || etym.includes('Cakau') ||
        etym.includes('Lau') || etym.includes('Rewa') || etym.includes('Nait.')) {
      return etym;
    }
  }
  return null;
}

/**
 * Extract main English translation, removing etymology and extra info
 */
function extractEnglishTranslation(text) {
  // Remove etymology in parentheses at the beginning
  let clean = text.replace(/^\s*\([^)]+\)\s*/, '');
  
  // Remove part of speech markers
  clean = clean.replace(/^\s*(n\.|noun|v\.|verb|adj\.|adjective|adv\.|adverb|prep\.|preposition|conj\.|conjunction|inter\.|interjection|pron\.|pronoun|art\.|article|particle|num\.|numeral)\s*/i, '');
  
  // Take everything up to first period or double space (often separates definition from examples)
  const mainDef = clean.split(/\.\s+[A-Z]|  [A-Z]/)[0];
  
  // Clean up and truncate if too long
  return mainDef.trim().substring(0, 200);
}

/**
 * Extract variants of the main word
 */
function extractWordVariants(wordLine) {
  const variants = [];
  
  // Handle "(or)" pattern: "word1 (or) word2"
  if (wordLine.includes('(or)')) {
    const parts = wordLine.split('(or)').map(p => p.trim());
    variants.push(...parts);
  }
  // Handle comma-separated variants: "word1, word2"
  else if (wordLine.includes(',') && !wordLine.includes('(')) {
    const parts = wordLine.split(',').map(p => p.trim());
    variants.push(...parts);
  }
  else {
    variants.push(wordLine.trim());
  }
  
  // Clean each variant - remove numbering and extra whitespace
  return variants
    .map(v => v.replace(/^\d+\.\s*/, '').trim())
    .filter(v => v.length > 0 && v.length < 50)
    .map(v => v.toLowerCase());
}

/**
 * Parse dictionary entries from text content
 */
function parseDictionaryEntries(content) {
  const lines = content.split('\n');
  const entries = [];
  let currentEntryLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines - they mark the end of an entry
    if (!line) {
      if (currentEntryLines.length > 0) {
        try {
          const fullText = currentEntryLines.join(' ').trim();
          const processed = processEntry(fullText);
          if (processed && processed.length > 0) {
            entries.push(...processed);
          }
        } catch (error) {
          console.warn(`Error processing entry: ${error.message}`);
        }
        currentEntryLines = [];
      }
      continue;
    }
    
    // Check if this line starts a new entry (word at beginning, contains part of speech markers)
    const startsNewEntry = /^[a-zA-Z]/.test(line) && 
                          (line.includes(' n.') || line.includes(' v.') || line.includes(' adj.') || 
                           line.includes(' adv.') || line.includes('(Eng.') || line.includes('(or)'));
    
    if (startsNewEntry && currentEntryLines.length > 0) {
      // Process previous entry
      try {
        const fullText = currentEntryLines.join(' ').trim();
        const processed = processEntry(fullText);
        if (processed && processed.length > 0) {
          entries.push(...processed);
        }
      } catch (error) {
        console.warn(`Error processing entry: ${error.message}`);
      }
      currentEntryLines = [line];
    } else {
      currentEntryLines.push(line);
    }
  }
  
  // Process final entry
  if (currentEntryLines.length > 0) {
    try {
      const fullText = currentEntryLines.join(' ').trim();
      const processed = processEntry(fullText);
      if (processed && processed.length > 0) {
        entries.push(...processed);
      }
    } catch (error) {
      console.warn(`Error processing entry: ${error.message}`);
    }
  }
  
  return entries;
}

/**
 * Process a single dictionary entry
 */
function processEntry(fullText) {
  if (!fullText || fullText.length < 5) return null;
  
  // Extract the headword - everything before the first parenthesis or part of speech marker
  const headwordMatch = fullText.match(/^([a-zA-Z][a-zA-Z,\s\d]*?)(?:\s+\(|\s+n\.||\s+v\.||\s+adj\.)/);
  if (!headwordMatch) return null;
  
  let headwordPart = headwordMatch[1].trim();
  
  // Handle numbered entries like "ba 1." or "koko 2."
  headwordPart = headwordPart.replace(/\s+\d+\.?\s*$/, '');
  
  // Extract word variants
  const words = extractWordVariants(headwordPart);
  if (words.length === 0) return null;
  
  // Extract definition information
  const partOfSpeech = extractPartOfSpeech(fullText);
  const englishTranslation = extractEnglishTranslation(fullText);
  const etymology = extractEtymology(fullText);
  
  if (!englishTranslation || englishTranslation.length < 3) {
    return null; // Skip entries without valid translations
  }
  
  const entries = [];
  
  // Create entries for each word variant
  for (const word of words) {
    if (word.length < 2 || word.length > 30) continue; // Skip invalid words
    
    const entry = {
      word: word,
      language: 'fijian',
      english_translation: englishTranslation,
      part_of_speech: partOfSpeech,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Add optional fields
    if (etymology) {
      entry.etymology = etymology;
    }
    
    // Extract example if present (very basic extraction)
    const exampleMatch = fullText.match(/([A-Z][^.]{10,100}\.)/);
    if (exampleMatch && exampleMatch[1].length < 150) {
      entry.example_sentences = [exampleMatch[1]];
    }
    
    entries.push(entry);
  }
  
  return entries;
}

/**
 * Batch write entries to DynamoDB
 */
async function batchWriteEntries(entries, tableName) {
  const batchSize = 25; // DynamoDB limit
  let processed = 0;
  let errors = 0;
  
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
      console.log(`✓ Processed ${processed}/${entries.length} entries`);
    } catch (error) {
      console.error(`✗ Error writing batch ${i/batchSize + 1}:`, error.message);
      errors += batch.length;
      
      // Try individual puts for failed batch
      for (const entry of batch) {
        try {
          await ddbClient.send(new PutItemCommand({
            TableName: tableName,
            Item: marshall(entry)
          }));
          processed++;
        } catch (singleError) {
          console.error(`✗ Failed to write entry "${entry.word}":`, singleError.message);
        }
      }
    }
    
    // Add small delay to avoid throttling
    if (i + batchSize < entries.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return { processed, errors };
}

/**
 * Main function to parse and ingest dictionary
 */
async function parseAndIngestDictionary(filePath, tableName) {
  console.log('Starting Fijian dictionary parsing and ingestion...');
  console.log(`File: ${filePath}`);
  console.log(`Target table: ${tableName}`);
  
  // Read dictionary file
  if (!fs.existsSync(filePath)) {
    throw new Error(`Dictionary file not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`Read ${content.length} characters from dictionary file`);
  
  // Parse entries
  console.log('Parsing dictionary entries...');
  const entries = parseDictionaryEntries(content);
  console.log(`Parsed ${entries.length} dictionary entries`);
  
  if (entries.length === 0) {
    throw new Error('No valid dictionary entries found in file');
  }
  
  // Show sample entries
  console.log('\nSample parsed entries:');
  entries.slice(0, 3).forEach((entry, i) => {
    console.log(`${i + 1}. "${entry.word}" -> "${entry.english_translation}" (${entry.part_of_speech})`);
  });
  
  // Ingest to DynamoDB
  console.log(`\nIngesting ${entries.length} entries to DynamoDB...`);
  const result = await batchWriteEntries(entries, tableName);
  
  console.log(`\n✅ Dictionary ingestion complete!`);
  console.log(`Successfully processed: ${result.processed} entries`);
  console.log(`Errors: ${result.errors} entries`);
  
  return result;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const filePath = process.argv[2] || '/tmp/fijian-dict-preprocessed-easy.txt';
  const tableName = process.env.DICTIONARY_TABLE || 'DictionaryTable';
  
  parseAndIngestDictionary(filePath, tableName)
    .then(result => {
      console.log('Dictionary ingestion completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Dictionary ingestion failed:', error);
      process.exit(1);
    });
}

export { parseAndIngestDictionary, parseDictionaryEntries };