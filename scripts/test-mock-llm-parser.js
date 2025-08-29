#!/usr/bin/env node

/**
 * Mock LLM Dictionary Parser for Testing Restructured Output
 * Simulates Claude API responses to test the new format
 */

const fs = require('fs');
const path = require('path');

// Import the test mock responses
const { createMockLLMResponse } = require('./test-llm-restructured.js');

/**
 * Mock Dictionary Entry LLM Parser Class
 * Simulates the real parser without API calls
 */
class MockLLMDictionaryParser {
  constructor(options = {}) {
    this.model = options.model || 'mock-claude-3-haiku';
    this.maxTokens = options.maxTokens || 1000;
  }

  /**
   * Split text into dictionary entry chunks (same as real parser)
   */
  chunkDictionaryText(text) {
    console.log('📝 Chunking dictionary text...');
    
    let chunks = text.split(/\n\s*\n/)
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 10);

    if (chunks.length === 1) {
      chunks = text.split(/(?=\b[a-zA-Z]+\s+\d+\.)/)
        .map(chunk => chunk.trim())
        .filter(chunk => chunk.length > 10);
    }

    if (chunks.length === 1) {
      chunks = text.split(/(?=\b[a-zA-Z]+\s+[-–—:.]|\b[a-zA-Z]+\s+\([^)]+\))/)
        .map(chunk => chunk.trim())
        .filter(chunk => chunk.length > 10);
    }

    console.log(`✅ Created ${chunks.length} chunks for processing`);
    return chunks;
  }

  /**
   * Mock LLM call that returns structured data
   */
  async callLLM(prompt) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Return mock structured data based on the prompt content
    if (prompt.includes('koko')) {
      return [
        {
          fijian: "koko",
          english: "cocoa",
          pos: "n.",
          entryNumber: 2,
          etymology: "Eng.",
          contextualNotes: "There are efforts to revive the industry. The problems have been a severely fluctuating world price, black pod disease in rainy areas, and a lack of disciplined care for the trees.",
          examples: ["cocoa farming"],
          technicalNotes: "Agricultural challenges include black pod disease"
        },
        {
          fijian: "koko",
          english: "Fijian pudding of grated ivi fruit (Polynesian chestnut), baked in earth oven",
          pos: "n.",
          entryNumber: 3,
          regionalVariations: "regional food of Rewa",
          contextualNotes: "the tree has been common; it grows in low-lying, wet areas",
          culturalContext: "Traditional Fijian food preparation using earth oven"
        }
      ];
    } else if (prompt.includes('kana')) {
      return [
        {
          fijian: "kana",
          english: "to eat, food, meal",
          pos: "v./n.",
          related: ["kanace"]
        },
        {
          fijian: "kanace",
          english: "to eat together, share a meal",
          pos: "v.",
          related: ["kana"],
          culturalContext: "Reflects Fijian community values"
        }
      ];
    }
    
    // Default response
    return [];
  }

  /**
   * Process a single entry chunk (same as real parser)
   */
  async processChunk(chunk, index) {
    console.log(`🤖 Processing chunk ${index + 1}: "${chunk.substring(0, 50)}..."`);
    
    try {
      const prompt = `Mock prompt for: ${chunk}`;
      const entries = await this.callLLM(prompt);
      
      // Validate and clean entries (same as real parser)
      const validEntries = entries.filter(entry => {
        if (!entry.fijian || !entry.english) {
          console.log(`⚠️  Skipping invalid entry: ${JSON.stringify(entry)}`);
          return false;
        }
        
        if (!/^[a-zA-Z]+$/.test(entry.fijian)) {
          console.log(`⚠️  Skipping non-Fijian word: ${entry.fijian}`);
          return false;
        }
        
        return true;
      }).map(entry => ({
        ...entry,
        sourceChunk: index,
        rawChunk: chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''),
        extractionTimestamp: new Date().toISOString(),
        examples: entry.examples || [],
        related: entry.related || [],
        crossReferences: entry.crossReferences || [],
        usageExamples: entry.usageExamples || []
      }));
      
      console.log(`✅ Extracted ${validEntries.length} valid entries from chunk ${index + 1}`);
      return validEntries;
      
    } catch (error) {
      console.error(`❌ Failed to process chunk ${index + 1}:`, error.message);
      return [];
    }
  }

  /**
   * Parse dictionary text (same as real parser)
   */
  async parseDictionary(text) {
    console.log('🚀 Starting Mock LLM-based dictionary parsing...');
    
    const chunks = this.chunkDictionaryText(text);
    const allEntries = [];
    const errors = [];
    
    for (let i = 0; i < chunks.length; i++) {
      try {
        const entries = await this.processChunk(chunks[i], i);
        allEntries.push(...entries);
        
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        errors.push(`Chunk ${i + 1}: ${error.message}`);
      }
    }

    const stats = {
      totalChunks: chunks.length,
      processedChunks: chunks.length - errors.length,
      entriesExtracted: allEntries.length,
      errors: errors,
      model: this.model,
      timestamp: new Date().toISOString()
    };

    console.log(`\n🎉 Mock LLM parsing completed!`);
    console.log(`📊 Results: ${allEntries.length} entries from ${chunks.length} chunks`);
    
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} chunks had errors`);
    }

    return {
      metadata: {
        parser: 'mock-llm-dictionary-parser',
        model: this.model,
        ...stats
      },
      entries: allEntries,
      stats
    };
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('🧪 Mock LLM Dictionary Parser - Restructured Format Test\n');

  if (process.argv.length < 3) {
    console.error('Usage: node scripts/test-mock-llm-parser.js <input.txt>');
    process.exit(1);
  }

  const inputPath = process.argv[2];
  
  try {
    // Load input
    console.log(`📖 Loading input from: ${inputPath}`);
    const text = fs.readFileSync(inputPath, 'utf8');

    // Create mock parser
    const parser = new MockLLMDictionaryParser();

    // Parse dictionary
    const results = await parser.parseDictionary(text);

    // Save results
    const outputFile = '/tmp/mock-llm-restructured-output.json';
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${outputFile}`);

    // Display summary
    console.log('\n📊 Summary:');
    console.log(`   - Input chunks: ${results.stats.totalChunks}`);
    console.log(`   - Processed chunks: ${results.stats.processedChunks}`);
    console.log(`   - Entries extracted: ${results.stats.entriesExtracted}`);
    console.log(`   - Model used: ${results.metadata.model}`);
    
    console.log('\n💡 Next steps:');
    console.log('   - Review the extracted entries for quality');
    console.log('   - Entries are now in DictionaryEntry format for RAG ingestion');
    console.log('   - Use structured JSON with existing dictionary processor');

    // Display sample entries
    console.log('\n📋 Sample Entries:');
    results.entries.slice(0, 3).forEach((entry, index) => {
      console.log(`\n${index + 1}. ${entry.fijian}${entry.entryNumber ? ' ' + entry.entryNumber : ''}`);
      console.log(`   English: ${entry.english}`);
      if (entry.pos) console.log(`   Part of Speech: ${entry.pos}`);
      if (entry.etymology) console.log(`   Etymology: ${entry.etymology}`);
      if (entry.examples && entry.examples.length > 0) {
        console.log(`   Examples: ${entry.examples.join(', ')}`);
      }
      if (entry.culturalContext) {
        console.log(`   Cultural Context: ${entry.culturalContext}`);
      }
    });

  } catch (error) {
    console.error('\n❌ Mock parsing failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { MockLLMDictionaryParser };