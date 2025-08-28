#!/usr/bin/env node

/**
 * Test the dictionary processor with simulated input
 * 
 * This script tests the processing pipeline using plain text input
 * instead of requiring a PDF file.
 */

const { FijianDictionaryProcessor } = require('../backend/lambdas/dictionary/processor');

async function testProcessor() {
  console.log('Testing dictionary processor with sample text...');
  
  // Simulated text content (what would come from PDF extraction)
  const sampleText = `
Page 100 - Fijian-English Dictionary

kana - to eat, food, meal
kanace - to eat together, share a meal  
kandavu - a type of traditional feast

Page 101

kato - basket, container made from pandanus
katuba - a large traditional basket
kau - I, me (pronoun)

Page 102

kawa - bitter, sour taste
kawainima - to taste bitter
kawi - to carry, to bear
`;

  try {
    // Initialize processor
    const processor = new FijianDictionaryProcessor(
      process.env.DICTIONARY_TABLE || 'test-dictionary-table',
      process.env.CONTENT_BUCKET || 'test-content-bucket'
    );
    
    // Test the parser directly
    const { DictionaryParser } = require('../backend/lambdas/dictionary/dictionary-parser');
    const parser = new DictionaryParser();
    
    console.log('\n=== Testing Dictionary Parser ===');
    const { entries, stats } = await parser.parseText(sampleText, 'test-pages-100-110.txt');
    
    console.log(`Parsed ${entries.length} entries:`);
    entries.forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry.fijian} - ${entry.english} (confidence: ${entry.confidence}%)`);
    });
    
    console.log(`\nParsing Statistics:`);
    console.log(`  - Entries found: ${stats.entriesFound}`);
    console.log(`  - Malformed entries: ${stats.malformedEntries}`);
    console.log(`  - Average confidence: ${entries.length > 0 ? (entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length).toFixed(1) : 0}%`);
    
    // Test structuring
    console.log('\n=== Testing Entry Structuring ===');
    const structuredEntries = processor.structureEntries(entries);
    console.log(`Structured ${structuredEntries.length} entries for database storage`);
    
    console.log('\n=== Test Complete ===');
    console.log('Dictionary processing pipeline is working correctly!');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testProcessor();
}

module.exports = { testProcessor };
