/**
 * Integration Test: Dictionary lookup in VocabularyProcessingLambda
 * 
 * This test simulates the dictionary lookup functionality that the 
 * VocabularyProcessingLambda uses to enrich vocabulary entries
 */

import { parseDictionary } from './simple-dict-parser.js';
import fs from 'fs';

// Mock the DynamoDB lookup functionality 
class MockDictionaryService {
  constructor(entries) {
    // Create a lookup map for fast access
    this.dictionary = new Map();
    entries.forEach(entry => {
      this.dictionary.set(entry.word, entry);
    });
    console.log(`Loaded ${this.dictionary.size} dictionary entries for testing`);
  }
  
  // Simulate the lookupWordInDictionary function from VocabularyProcessingLambda
  async lookupWordInDictionary(word) {
    const entry = this.dictionary.get(word.toLowerCase());
    if (entry) {
      return {
        definition: entry.english_translation,
        context: entry.part_of_speech ? `${entry.part_of_speech}. ${entry.english_translation}` : undefined
      };
    }
    return {};
  }
}

/**
 * Test the integration with sample Fijian text
 */
async function testVocabularyProcessingIntegration() {
  console.log('=== Testing VocabularyProcessingLambda Dictionary Integration ===\n');
  
  // Load dictionary entries
  const dictPath = '/tmp/fijian-dict-preprocessed-easy.txt';
  if (!fs.existsSync(dictPath)) {
    console.error('Dictionary file not found. Run dry-run first.');
    return;
  }
  
  const content = fs.readFileSync(dictPath, 'utf8');
  const dictionaryEntries = parseDictionary(content);
  
  // Create mock dictionary service
  const dictService = new MockDictionaryService(dictionaryEntries);
  
  // Sample Fijian text that might come from an article
  const sampleFijianText = `
    Bula vinaka! Na noda vakasama e baleta na noda vanua kei na noda bose levu. 
    Sa dodonu me da vakabibitaka na noda itovo vinaka kei na noda vosa vaka-Viti.
    Na vale ni volavola e dua na ka sa bibi sara vei keda na lewenivanua.
    Era sega ni rawa ni vakadinadina na yaga ni noda vosa kei na noda kalou.
  `;
  
  // Basic tokenization (simplified version of what's in VocabularyProcessingLambda)
  const words = sampleFijianText
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .map(word => word.trim())
    .filter(word => word.length > 1 && /^[a-z]+$/.test(word));
  
  console.log(`Sample text contains ${words.length} words`);
  console.log('Sample words:', words.slice(0, 10).join(', '), '...\n');
  
  // Test dictionary lookups for each word
  console.log('Testing dictionary lookups:');
  let foundCount = 0;
  let totalCount = 0;
  
  const uniqueWords = [...new Set(words)];
  
  for (const word of uniqueWords) {
    totalCount++;
    const lookup = await dictService.lookupWordInDictionary(word);
    
    if (lookup.definition) {
      foundCount++;
      console.log(`✓ "${word}" -> "${lookup.definition}"`);
      if (lookup.context) {
        console.log(`   Context: ${lookup.context}`);
      }
    } else {
      console.log(`✗ "${word}" -> not found`);
    }
  }
  
  console.log(`\n=== Dictionary Lookup Results ===`);
  console.log(`Total unique words tested: ${totalCount}`);
  console.log(`Dictionary matches found: ${foundCount}`);
  console.log(`Coverage: ${((foundCount / totalCount) * 100).toFixed(1)}%`);
  
  if (foundCount > 0) {
    console.log('\n✅ Integration test successful! Dictionary lookups are working.');
    console.log('The VocabularyProcessingLambda will be able to enrich vocabulary records with definitions.');
  } else {
    console.log('\n⚠️  No dictionary matches found. This could indicate:');
    console.log('- Dictionary entries use different word forms');
    console.log('- Sample text contains uncommon words');
    console.log('- Dictionary parser needs refinement');
  }
  
  // Test specific common words that should definitely be in the dictionary
  console.log('\n=== Testing Essential Fijian Words ===');
  const essentialWords = ['bula', 'vinaka', 'na', 'sa', 'vale', 'vanua', 'vosa', 'levu'];
  
  for (const word of essentialWords) {
    const lookup = await dictService.lookupWordInDictionary(word);
    if (lookup.definition) {
      console.log(`✓ "${word}" -> "${lookup.definition}"`);
    } else {
      console.log(`✗ "${word}" -> missing from dictionary`);
    }
  }
  
  return { totalCount, foundCount, coverage: (foundCount / totalCount) * 100 };
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testVocabularyProcessingIntegration()
    .then(result => {
      if (result && result.foundCount > 0) {
        console.log('\n🎉 Integration test completed successfully!');
      } else {
        console.log('\n❌ Integration test needs improvement.');
      }
    })
    .catch(error => {
      console.error('Integration test failed:', error.message);
      process.exit(1);
    });
}