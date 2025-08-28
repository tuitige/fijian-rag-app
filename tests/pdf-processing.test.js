/**
 * Test PDF Processing Pipeline
 * 
 * Simple test to validate the PDF parsing and chunk extraction functionality
 */

import * as fs from 'fs';
import * as path from 'path';
import { DictionaryParser } from '../backend/lambdas/dictionary/dictionary-parser';
import { OutputFormatter } from '../backend/lambdas/dictionary/output-formatter';

// Mock sample PDF text content for testing
const SAMPLE_PDF_TEXT = `
Fijian-English Dictionary

bula - hello, life, health, greetings
This is the most common greeting in Fiji.
Example: Bula vinaka! - Good hello!

vinaka (adj./interj.) - good, thank you
Used to express gratitude or describe something positive.
Example: Vinaka vaka levu - Thank you very much

levu - big, large, much, very
Can be used as adjective or adverb.
Example: Vale levu - big house
Example: Vinaka vaka levu - thank you very much

lailai - small, little
Opposite of levu.
Example: Vale lailai - small house

vale - house, home, building
Basic word for any structure or dwelling.
Example: Au curu ki vale - I go into the house

wai - water
Essential word for daily life.
Example: Wai bose - cold water

tamana - father, dad
Family relationship term.
Example: Noqu tamana - my father

tinana - mother, mom  
Family relationship term.
Example: Noqu tinana - my mother

gone - child, children
Used for young people.
Example: Gone lailai - small child

yaqona - kava
Traditional ceremonial drink.
Example: Sevusevu yaqona - kava ceremony
`;

describe('PDF Processing Pipeline', () => {
  const mockBucketName = 'test-bucket';
  const parser = new DictionaryParser();
  const outputFormatter = new OutputFormatter(mockBucketName, 'test-outputs/');

  beforeAll(() => {
    // Create temp directory for test outputs
    const tempDir = '/tmp/pdf-processing-test';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  test('Parser should extract dictionary entries from text', async () => {
    const { entries, stats } = await parser.parseText(SAMPLE_PDF_TEXT, 'test-dictionary.pdf');
    
    expect(entries.length).toBeGreaterThan(0);
    expect(stats.entriesFound).toBeGreaterThan(0);
    
    // Check that we found the expected entries
    const headwords = entries.map(e => e.fijian);
    expect(headwords).toContain('bula');
    expect(headwords).toContain('vinaka');
    expect(headwords).toContain('levu');
    
    // Check that entries have required fields
    entries.forEach(entry => {
      expect(entry.fijian).toBeTruthy();
      expect(entry.english).toBeTruthy();
      expect(entry.confidence).toBeGreaterThan(0);
      expect(entry.sourceText).toBeTruthy();
    });
    
    console.log(`✅ Parsed ${entries.length} entries with ${stats.errorsCount || 0} errors`);
  });

  test('Parser should handle part-of-speech tags', async () => {
    const { entries } = await parser.parseText(SAMPLE_PDF_TEXT, 'test-dictionary.pdf');
    
    const vinaka = entries.find(e => e.fijian === 'vinaka');
    expect(vinaka?.pos).toBeTruthy();
    expect(vinaka?.pos).toContain('adj');
    
    console.log(`✅ Part-of-speech parsing works: ${vinaka?.pos}`);
  });

  test('Parser should extract examples', async () => {
    const { entries } = await parser.parseText(SAMPLE_PDF_TEXT, 'test-dictionary.pdf');
    
    const bula = entries.find(e => e.fijian === 'bula');
    expect(bula?.examples).toBeTruthy();
    expect(bula?.examples?.length).toBeGreaterThan(0);
    
    console.log(`✅ Example extraction works: ${bula?.examples?.[0]}`);
  });

  test('Parser should assign reasonable confidence scores', async () => {
    const { entries } = await parser.parseText(SAMPLE_PDF_TEXT, 'test-dictionary.pdf');
    
    const confidences = entries.map(e => e.confidence);
    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    
    expect(avgConfidence).toBeGreaterThan(50); // Should have reasonable confidence
    
    console.log(`✅ Average confidence: ${avgConfidence.toFixed(1)}%`);
  });

  test('Output formatter should normalize entries correctly', () => {
    // Create mock parsed entries
    const mockEntries = [
      {
        fijian: 'bula',
        english: 'hello, life, health',
        pos: 'noun/interjection',
        examples: ['Bula vinaka! - Good hello!'],
        pronunciation: 'boo-lah',
        related: ['vinaka'],
        sourceText: 'bula - hello, life, health',
        confidence: 95,
        pageNumber: 1,
        lineNumbers: [1],
        parsingNotes: ['High confidence match']
      }
    ];

    // Test normalization
    const formatter = new (class extends OutputFormatter {
      public testNormalizeEntries(entries: any[]) {
        return this['normalizeEntries'](entries);
      }
    })(mockBucketName);

    const normalized = formatter.testNormalizeEntries(mockEntries);
    
    expect(normalized.length).toBe(1);
    expect(normalized[0].id).toBeTruthy();
    expect(normalized[0].headword).toBe('bula');
    expect(normalized[0].confidence_score).toBe(95);
    expect(normalized[0].source_metadata).toBeTruthy();
    
    console.log('✅ Entry normalization works correctly');
  });

  test('Output formatter should create valid CSV content', () => {
    const mockNormalizedEntries = [
      {
        id: 'entry_1_bula',
        headword: 'bula',
        definition: 'hello, life, health',
        part_of_speech: 'noun/interjection',
        examples: ['Bula vinaka! - Good hello!'],
        pronunciation: 'boo-lah',
        related_words: ['vinaka'],
        confidence_score: 95,
        source_metadata: {
          original_text: 'bula - hello, life, health',
          page_number: 1,
          line_numbers: [1],
          parsing_notes: ['High confidence match']
        }
      }
    ];

    const formatter = new (class extends OutputFormatter {
      public testCreateCSVContent(entries: any[]) {
        return this['createCSVContent'](entries);
      }
    })(mockBucketName);

    const csvContent = formatter.testCreateCSVContent(mockNormalizedEntries);
    
    expect(csvContent).toContain('id,headword,definition');
    expect(csvContent).toContain('entry_1_bula,bula,"hello, life, health"');
    
    const lines = csvContent.split('\n');
    expect(lines.length).toBe(2); // Header + 1 data row
    
    console.log('✅ CSV formatting works correctly');
  });

  test('Processing statistics should be meaningful', async () => {
    const { entries, stats } = await parser.parseText(SAMPLE_PDF_TEXT, 'test-dictionary.pdf');
    
    expect(stats.totalLines).toBeGreaterThan(0);
    expect(stats.entriesFound).toBe(entries.length);
    expect(stats.confidenceDistribution).toBeTruthy();
    expect(stats.commonPatterns).toBeTruthy();
    
    console.log('✅ Processing statistics:', {
      totalLines: stats.totalLines,
      entriesFound: stats.entriesFound,
      malformed: stats.malformedEntries,
      confidence: stats.confidenceDistribution
    });
  });
});

// Manual test runner
if (require.main === module) {
  console.log('🚀 Running PDF Processing Pipeline Tests...\n');
  
  const runTests = async () => {
    try {
      const parser = new DictionaryParser();
      
      console.log('1️⃣ Testing text parsing...');
      const { entries, stats } = await parser.parseText(SAMPLE_PDF_TEXT, 'manual-test.pdf');
      
      console.log(`✅ Parsed ${entries.length} entries`);
      console.log(`   - Average confidence: ${(entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length).toFixed(1)}%`);
      console.log(`   - Entries with examples: ${entries.filter(e => e.examples && e.examples.length > 0).length}`);
      console.log(`   - Entries with POS tags: ${entries.filter(e => e.pos).length}`);
      
      console.log('\n2️⃣ Sample parsed entries:');
      entries.slice(0, 3).forEach((entry, i) => {
        console.log(`   ${i + 1}. ${entry.fijian} (${entry.confidence}%) - ${entry.english.substring(0, 50)}...`);
      });
      
      console.log('\n3️⃣ Processing statistics:');
      console.log(`   - Total lines processed: ${stats.totalLines}`);
      console.log(`   - Entries found: ${stats.entriesFound}`);
      console.log(`   - Malformed entries: ${stats.malformedEntries}`);
      console.log(`   - Confidence distribution:`, stats.confidenceDistribution);
      
      console.log('\n🎉 All tests completed successfully!');
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      process.exit(1);
    }
  };
  
  runTests();
}