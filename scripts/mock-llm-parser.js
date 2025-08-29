#!/usr/bin/env node

/**
 * Mock LLM Dictionary Parser for Testing
 * 
 * This is a test version of the LLM dictionary parser that uses mock responses
 * instead of actual API calls to test the parsing logic without requiring API keys.
 */

const fs = require('fs');
const path = require('path');

/**
 * Mock Dictionary Entry LLM Parser Class
 * Simulates LLM responses for testing
 */
class MockLLMDictionaryParser {
  constructor(options = {}) {
    this.model = 'mock-claude-3-haiku';
    console.log('🧪 Using mock LLM parser for testing (no API calls)');
  }

  /**
   * Split text into dictionary entry chunks (same as real parser)
   */
  chunkDictionaryText(text) {
    console.log('📝 Chunking dictionary text...');
    
    // Split by double newlines (paragraph breaks) or numbered entries
    let chunks = text.split(/\n\s*\n/)
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 10);

    // Also try to split by numbered entries if no paragraph breaks
    if (chunks.length === 1) {
      chunks = text.split(/(?=\b[a-zA-Z]+\s+\d+\.)/)
        .map(chunk => chunk.trim())
        .filter(chunk => chunk.length > 10);
    }

    // Also try to split by entries starting with Fijian words followed by definitions
    if (chunks.length === 1) {
      chunks = text.split(/(?=\b[a-zA-Z]+\s+[-–—:.]|\b[a-zA-Z]+\s+\([^)]+\))/)
        .map(chunk => chunk.trim())
        .filter(chunk => chunk.length > 10);
    }

    console.log(`✅ Created ${chunks.length} chunks for processing`);
    return chunks;
  }

  /**
   * Mock LLM call that simulates Claude's response
   */
  async callLLM(entry) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log(`🔍 Mock parsing entry: "${entry}"`);
    
    // Mock parsing logic based on patterns
    const mockEntries = this.mockParseEntry(entry);
    
    // Return first entry if multiple found
    return mockEntries[0] || { headword: "unknown", definition: "unknown", notes: "" };
  }

  /**
   * Mock entry parsing logic that simulates what Claude would do
   */
  mockParseEntry(text) {
    const entries = [];
    
    // Pattern 1: "word number. (etymology) pos. definition"
    const pattern1 = /^([a-zA-Z]+)\s*(\d+)\.\s*(?:\(([^)]+)\))?\s*([nv]\.)?\s*(.+)$/;
    const match1 = text.match(pattern1);
    if (match1) {
      const [, headword, number, etymology, pos, definition] = match1;
      entries.push({
        headword: headword.toLowerCase(),
        definition: definition.trim(),
        notes: [
          etymology ? `Etymology: ${etymology}` : null,
          pos ? `Part of speech: ${pos}` : null,
          number ? `Entry number: ${number}` : null
        ].filter(Boolean).join('; ')
      });
    }

    // Pattern 2: "word - definition"
    const pattern2 = /^([a-zA-Z]+)\s*[-–—]\s*(.+)$/;
    const match2 = text.match(pattern2);
    if (match2 && entries.length === 0) {
      const [, headword, definition] = match2;
      entries.push({
        headword: headword.toLowerCase(),
        definition: definition.trim(),
        notes: ""
      });
    }

    // Pattern 3: "word: definition"
    const pattern3 = /^([a-zA-Z]+):\s*(.+)$/;
    const match3 = text.match(pattern3);
    if (match3 && entries.length === 0) {
      const [, headword, definition] = match3;
      entries.push({
        headword: headword.toLowerCase(),
        definition: definition.trim(),
        notes: ""
      });
    }

    // Fallback: try to extract first word as headword
    if (entries.length === 0) {
      const words = text.split(/\s+/);
      if (words.length > 0) {
        const headword = words[0].replace(/[^\w]/g, '').toLowerCase();
        const definition = words.slice(1).join(' ');
        entries.push({
          headword,
          definition: definition || "definition not found",
          notes: "Fallback parsing used"
        });
      }
    }

    return entries;
  }

  /**
   * Process a single entry chunk (same interface as real parser)
   */
  async processChunk(chunk, index) {
    console.log(`🧪 Mock processing chunk ${index + 1}: "${chunk.substring(0, 50)}..."`);
    
    try {
      console.log(`🔍 Debug chunk content: "${chunk}"`);
      const result = await this.callLLM(chunk); // Pass chunk directly instead of prompt
      
      const entries = Array.isArray(result) ? result : [result];
      
      const validEntries = entries.filter(entry => {
        return entry.headword && entry.definition && entry.headword !== "unknown";
      }).map(entry => ({
        ...entry,
        sourceChunk: index,
        rawChunk: chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''),
        extractionTimestamp: new Date().toISOString(),
        parserType: 'mock-llm'
      }));
      
      console.log(`✅ Mock extracted ${validEntries.length} entries from chunk ${index + 1}`);
      return validEntries;
      
    } catch (error) {
      console.error(`❌ Failed to process chunk ${index + 1}:`, error.message);
      return [];
    }
  }

  /**
   * Parse dictionary text using mock LLM (same interface as real parser)
   */
  async parseDictionary(text) {
    console.log('🧪 Starting mock LLM-based dictionary parsing...');
    
    const chunks = this.chunkDictionaryText(text);
    const allEntries = [];
    const errors = [];
    
    for (let i = 0; i < chunks.length; i++) {
      try {
        const entries = await this.processChunk(chunks[i], i);
        allEntries.push(...entries);
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

  /**
   * Parse from JSON blocks (same as real parser)
   */
  async parseFromBlocks(jsonData) {
    if (!jsonData.blocks || !Array.isArray(jsonData.blocks)) {
      throw new Error('Invalid JSON format. Expected "blocks" array.');
    }

    const text = jsonData.blocks
      .map(block => block.block || block.text || '')
      .filter(text => text.trim().length > 0)
      .join('\n\n');

    if (!text.trim()) {
      throw new Error('No text content found in blocks');
    }

    return await this.parseDictionary(text);
  }
}

/**
 * Main function for testing
 */
async function main() {
  console.log('🧪 Mock LLM Dictionary Parser - Testing Mode\n');

  if (process.argv.length < 3) {
    console.error('Usage: node scripts/mock-llm-parser.js <input-file>');
    process.exit(1);
  }

  const inputPath = process.argv[2];
  const outputPrefix = process.argv[3] || path.parse(inputPath).name + '-mock-llm-parsed';

  try {
    console.log(`📖 Loading input from: ${inputPath}`);
    
    if (!fs.existsSync(inputPath)) {
      console.error(`❌ Error: Input file not found: ${inputPath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(inputPath, 'utf8');
    
    let input;
    if (inputPath.toLowerCase().endsWith('.json')) {
      input = JSON.parse(content);
    } else {
      input = content;
    }

    const parser = new MockLLMDictionaryParser();

    let results;
    if (typeof input === 'string') {
      results = await parser.parseDictionary(input);
    } else {
      results = await parser.parseFromBlocks(input);
    }

    const outputFile = `${outputPrefix}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
    console.log(`💾 Mock results saved to: ${outputFile}`);

    console.log('\n📊 Mock Summary:');
    console.log(`   - Input chunks: ${results.stats.totalChunks}`);
    console.log(`   - Processed chunks: ${results.stats.processedChunks}`);
    console.log(`   - Entries extracted: ${results.stats.entriesExtracted}`);
    console.log(`   - Parser: ${results.metadata.parser}`);

  } catch (error) {
    console.error('\n❌ Mock parsing failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { MockLLMDictionaryParser };