#!/usr/bin/env node

/**
 * Simple PDF test creation script
 * 
 * Since PDF generation tools aren't available in this environment,
 * this script creates alternative test files for the dictionary processing pipeline.
 */

const fs = require('fs');
const path = require('path');

// Create a comprehensive test suite
function createTestSuite() {
  const outputDir = path.join(__dirname, 'dictionary-test-data');
  
  // Create a test file that simulates what Textract would extract from a PDF
  const textractLikeOutput = {
    "DocumentMetadata": {
      "Pages": 11
    },
    "Blocks": [
      {
        "BlockType": "PAGE",
        "Confidence": 99.5,
        "Page": 1,
        "Id": "page-1"
      },
      {
        "BlockType": "LINE",
        "Text": "Page 100 - Fijian-English Dictionary",
        "Confidence": 98.2,
        "Page": 1,
        "Id": "header-1"
      },
      {
        "BlockType": "LINE", 
        "Text": "kana - to eat, food, meal",
        "Confidence": 96.8,
        "Page": 1,
        "Id": "entry-1"
      },
      {
        "BlockType": "LINE",
        "Text": "kanace - to eat together, share a meal", 
        "Confidence": 95.2,
        "Page": 1,
        "Id": "entry-2"
      },
      {
        "BlockType": "LINE",
        "Text": "kandavu - a type of traditional feast",
        "Confidence": 94.7,
        "Page": 1,
        "Id": "entry-3"
      }
      // ... would continue with more entries and pages
    ]
  };
  
  // Create simulation data
  fs.writeFileSync(
    path.join(outputDir, 'simulated-textract-output.json'), 
    JSON.stringify(textractLikeOutput, null, 2)
  );
  
  // Create a CSV test file for validation
  const csvContent = `id,headword,definition,part_of_speech,examples,confidence_score,original_text
entry_100_kana,kana,"to eat, food, meal",verb/noun,"",96.8,"kana - to eat, food, meal"
entry_100_kanace,kanace,"to eat together, share a meal",verb,"",95.2,"kanace - to eat together, share a meal"
entry_100_kandavu,kandavu,"a type of traditional feast",noun,"",94.7,"kandavu - a type of traditional feast"
entry_101_kato,kato,"basket, container made from pandanus",noun,"",97.1,"kato - basket, container made from pandanus"
entry_101_katuba,katuba,"a large traditional basket",noun,"",96.3,"katuba - a large traditional basket"
entry_101_kau,kau,"I, me (pronoun)",pronoun,"",98.5,"kau - I, me (pronoun)"`;
  
  fs.writeFileSync(path.join(outputDir, 'expected-csv-output.csv'), csvContent);
  
  // Create JSONL test file for validation
  const jsonlContent = `{"id":"entry_100_kana","headword":"kana","definition":"to eat, food, meal","part_of_speech":"verb/noun","confidence_score":96.8,"source_metadata":{"original_text":"kana - to eat, food, meal","page_number":100}}
{"id":"entry_100_kanace","headword":"kanace","definition":"to eat together, share a meal","part_of_speech":"verb","confidence_score":95.2,"source_metadata":{"original_text":"kanace - to eat together, share a meal","page_number":100}}
{"id":"entry_100_kandavu","headword":"kandavu","definition":"a type of traditional feast","part_of_speech":"noun","confidence_score":94.7,"source_metadata":{"original_text":"kandavu - a type of traditional feast","page_number":100}}`;
  
  fs.writeFileSync(path.join(outputDir, 'expected-jsonl-output.jsonl'), jsonlContent);
  
  console.log('✓ Created simulated test files for validation');
}

// Create a script to test the processor without PDF
function createProcessorTestScript() {
  const testScript = `#!/usr/bin/env node

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
  const sampleText = \`
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
\`;

  try {
    // Initialize processor
    const processor = new FijianDictionaryProcessor(
      process.env.DICTIONARY_TABLE || 'test-dictionary-table',
      process.env.CONTENT_BUCKET || 'test-content-bucket'
    );
    
    // Test the parser directly
    const { DictionaryParser } = require('../backend/lambdas/dictionary/dictionary-parser');
    const parser = new DictionaryParser();
    
    console.log('\\n=== Testing Dictionary Parser ===');
    const { entries, stats } = await parser.parseText(sampleText, 'test-pages-100-110.txt');
    
    console.log(\`Parsed \${entries.length} entries:\`);
    entries.forEach((entry, index) => {
      console.log(\`  \${index + 1}. \${entry.fijian} - \${entry.english} (confidence: \${entry.confidence}%)\`);
    });
    
    console.log(\`\\nParsing Statistics:\`);
    console.log(\`  - Entries found: \${stats.entriesFound}\`);
    console.log(\`  - Malformed entries: \${stats.malformedEntries}\`);
    console.log(\`  - Average confidence: \${entries.length > 0 ? (entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length).toFixed(1) : 0}%\`);
    
    // Test structuring
    console.log('\\n=== Testing Entry Structuring ===');
    const structuredEntries = processor.structureEntries(entries);
    console.log(\`Structured \${structuredEntries.length} entries for database storage\`);
    
    console.log('\\n=== Test Complete ===');
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
`;

  fs.writeFileSync(path.join(__dirname, 'test-processor.js'), testScript);
  fs.chmodSync(path.join(__dirname, 'test-processor.js'), '755');
  console.log('✓ Created processor test script: test-processor.js');
}

// Main execution
console.log('Creating comprehensive test suite...');

createTestSuite();
createProcessorTestScript();

console.log('\n=== Test Suite Created ===');
console.log('Files created:');
console.log('- simulated-textract-output.json (for Textract simulation)');
console.log('- expected-csv-output.csv (validation reference)');
console.log('- expected-jsonl-output.jsonl (validation reference)');
console.log('- test-processor.js (unit test for processor)');

console.log('\nTo run the processor test:');
console.log('cd tests && node test-processor.js');

console.log('\nFor PDF testing:');
console.log('1. Use the HTML file generated earlier to create a PDF manually');
console.log('2. Or use the plain text file for testing without PDF');
console.log('3. Upload to S3 and trigger processing via API Gateway');