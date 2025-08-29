#!/usr/bin/env node

/**
 * Test script for LLM Dictionary Parser with restructured output
 * Tests the new DictionaryEntry format for RAG ingestion
 */

const fs = require('fs');
const path = require('path');

// Create a test function that simulates the new LLM response
function createMockLLMResponse() {
  return [
    {
      fijian: "koko",
      english: "cocoa",
      pos: "n.",
      entryNumber: 2,
      etymology: "Eng.",
      contextualNotes: "There are efforts to revive the industry. The problems have been a severely fluctuating world price, black pod disease in rainy areas, and a lack of disciplined care for the trees.",
      examples: ["cocoa farming", "koko industry"],
      usageExamples: ["The koko trees need careful attention"]
    },
    {
      fijian: "koko",
      english: "Fijian pudding of grated ivi fruit (Polynesian chestnut), baked in earth oven",
      pos: "n.",
      entryNumber: 3,
      regionalVariations: "This is a regional food of Rewa, where the tree has been common",
      contextualNotes: "it grows in low-lying, wet areas",
      culturalContext: "Traditional Fijian food preparation method using earth oven"
    },
    {
      fijian: "kana",
      english: "to eat, food, meal",
      pos: "v./n.",
      examples: ["kana vakalevu - big meal", "kana vuki - breakfast"],
      related: ["kanace"]
    },
    {
      fijian: "kanace",
      english: "to eat together, share a meal",
      pos: "v.",
      related: ["kana"],
      culturalContext: "Reflects Fijian values of community and sharing"
    }
  ];
}

// Test the restructured format
function testRestructuredFormat() {
  console.log('🧪 Testing LLM Dictionary Parser - Restructured Format\n');
  
  const mockEntries = createMockLLMResponse();
  
  console.log('📊 Sample Output in DictionaryEntry Format:\n');
  
  mockEntries.forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.fijian}${entry.entryNumber ? ' ' + entry.entryNumber : ''}`);
    console.log(`   English: ${entry.english}`);
    if (entry.pos) console.log(`   Part of Speech: ${entry.pos}`);
    if (entry.etymology) console.log(`   Etymology: ${entry.etymology}`);
    if (entry.examples && entry.examples.length > 0) {
      console.log(`   Examples: ${entry.examples.join(', ')}`);
    }
    if (entry.related && entry.related.length > 0) {
      console.log(`   Related: ${entry.related.join(', ')}`);
    }
    if (entry.culturalContext) {
      console.log(`   Cultural Context: ${entry.culturalContext}`);
    }
    if (entry.contextualNotes) {
      console.log(`   Notes: ${entry.contextualNotes}`);
    }
    console.log('');
  });
  
  // Create a sample test file in the expected format
  const testOutput = {
    metadata: {
      parser: 'llm-dictionary-parser',
      model: 'claude-3-haiku-20240307',
      totalChunks: 1,
      processedChunks: 1,
      entriesExtracted: mockEntries.length,
      errors: [],
      timestamp: new Date().toISOString()
    },
    entries: mockEntries.map((entry, index) => ({
      ...entry,
      sourceChunk: 0,
      rawChunk: `Mock test data for entry ${index + 1}`,
      extractionTimestamp: new Date().toISOString(),
      examples: entry.examples || [],
      related: entry.related || [],
      crossReferences: entry.crossReferences || [],
      usageExamples: entry.usageExamples || []
    })),
    stats: {
      totalChunks: 1,
      processedChunks: 1,
      entriesExtracted: mockEntries.length,
      errors: [],
      model: 'claude-3-haiku-20240307',
      timestamp: new Date().toISOString()
    }
  };
  
  // Save test output
  const outputPath = '/tmp/test-restructured-output.json';
  fs.writeFileSync(outputPath, JSON.stringify(testOutput, null, 2));
  console.log(`💾 Test output saved to: ${outputPath}`);
  
  // Validate against DictionaryEntry interface
  console.log('\n✅ Validation Results:');
  testOutput.entries.forEach((entry, index) => {
    const requiredFields = ['fijian', 'english'];
    const missingFields = requiredFields.filter(field => !entry[field]);
    
    if (missingFields.length === 0) {
      console.log(`   Entry ${index + 1} (${entry.fijian}): ✅ Valid`);
    } else {
      console.log(`   Entry ${index + 1} (${entry.fijian}): ❌ Missing: ${missingFields.join(', ')}`);
    }
  });
  
  console.log('\n🎯 Key Improvements:');
  console.log('   • Structured format ready for RAG ingestion');
  console.log('   • Separate fields for pos, etymology, examples');
  console.log('   • Cultural context and notes properly categorized');
  console.log('   • Related words and cross-references identified');
  console.log('   • Compatible with DictionaryEntry interface');
  
  return testOutput;
}

// Run test if called directly
if (require.main === module) {
  testRestructuredFormat();
}

module.exports = { testRestructuredFormat, createMockLLMResponse };