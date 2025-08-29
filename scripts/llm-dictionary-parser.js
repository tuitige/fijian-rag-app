#!/usr/bin/env node

/**
 * LLM-Based Dictionary Parser for Fijian Dictionary Entries
 * 
 * Uses Claude (via Anthropic API) to extract structured dictionary entries
 * from dictionary text blocks, providing more accurate parsing than regex-based approaches.
 * 
 * Usage:
 *   node scripts/llm-dictionary-parser.js <input.txt> [output-prefix]
 *   node scripts/llm-dictionary-parser.js <input.json> [output-prefix]
 *   
 * Examples:
 *   node scripts/llm-dictionary-parser.js fijian-dict.txt
 *   node scripts/llm-dictionary-parser.js dictionary-blocks.json parsed-entries
 * 
 * Input: 
 *   - Text file with dictionary entries (one per line or paragraph)
 *   - JSON file from extract-pdf-text.js with text blocks
 * Output: 
 *   - Structured JSON entries with Fijian headwords, definitions, and notes
 * 
 * Requirements:
 *   - ANTHROPIC_API_KEY environment variable set
 *   - Node.js 16+ 
 *   - @anthropic-ai/sdk package (included in project dependencies)
 */

const fs = require('fs');
const path = require('path');

// Check if Anthropic SDK is available
let Anthropic;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch (e) {
  console.error('❌ Error: @anthropic-ai/sdk not found. Please install it:');
  console.error('   npm install @anthropic-ai/sdk');
  process.exit(1);
}

/**
 * Dictionary Entry LLM Parser Class
 * Handles LLM-based extraction of dictionary entries
 */
class LLMDictionaryParser {
  constructor(options = {}) {
    // Get API key from environment or options
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      console.error('❌ Error: ANTHROPIC_API_KEY environment variable not set');
      console.error('   Please set your Anthropic API key:');
      console.error('   export ANTHROPIC_API_KEY=your-api-key-here');
      process.exit(1);
    }

    this.anthropic = new Anthropic({ apiKey });
    this.model = options.model || 'claude-3-haiku-20240307';
    this.maxTokens = options.maxTokens || 1000;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * Split text into dictionary entry chunks
   * @param {string} text - Raw dictionary text
   * @returns {Array<string>} - Array of entry chunks
   */
  chunkDictionaryText(text) {
    console.log('📝 Chunking dictionary text...');
    
    // Split by double newlines (paragraph breaks) or numbered entries
    let chunks = text.split(/\n\s*\n/)
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 10); // Filter out very short chunks

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
   * Generate extraction prompt for a dictionary entry chunk
   * @param {string} entry - Dictionary entry text
   * @returns {string} - LLM prompt
   */
  createExtractionPrompt(entry) {
    return `Extract the Fijian headword, English definition, and any notes from the following dictionary entry. The headword should always be a Fijian word. Output as JSON:

{ "headword": "...", "definition": "...", "notes": "..." }

Rules:
1. "headword" must be the main Fijian word being defined (not English)
2. "definition" should be the English translation/explanation
3. "notes" should include etymology, part of speech, usage examples, or cultural context
4. If multiple definitions exist for the same headword, create separate entries
5. Return only valid JSON, no explanations

Entry:
${entry}`;
  }

  /**
   * Call Claude API to extract dictionary entry data
   * @param {string} prompt - Extraction prompt
   * @returns {Promise<Object>} - Parsed entry data
   */
  async callLLM(prompt) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });

        const content = response.content[0].text.trim();
        
        // Try to parse JSON response
        try {
          const parsed = JSON.parse(content);
          return parsed;
        } catch (parseError) {
          // If JSON parsing fails, try to extract JSON from the response
          const jsonMatch = content.match(/\{[^}]+\}/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
          throw new Error(`Invalid JSON response: ${content}`);
        }
        
      } catch (error) {
        console.error(`⚠️  Attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.retryAttempts) {
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }
  }

  /**
   * Process a single entry chunk with LLM
   * @param {string} chunk - Dictionary entry text
   * @param {number} index - Chunk index for logging
   * @returns {Promise<Array>} - Array of extracted entries
   */
  async processChunk(chunk, index) {
    console.log(`🤖 Processing chunk ${index + 1}: "${chunk.substring(0, 50)}..."`);
    
    try {
      const prompt = this.createExtractionPrompt(chunk);
      const result = await this.callLLM(prompt);
      
      // Ensure result is an array
      const entries = Array.isArray(result) ? result : [result];
      
      // Validate and clean entries
      const validEntries = entries.filter(entry => {
        if (!entry.headword || !entry.definition) {
          console.log(`⚠️  Skipping invalid entry: ${JSON.stringify(entry)}`);
          return false;
        }
        
        // Ensure headword looks like a Fijian word (basic validation)
        if (!/^[a-zA-Z]+$/.test(entry.headword)) {
          console.log(`⚠️  Skipping non-Fijian headword: ${entry.headword}`);
          return false;
        }
        
        return true;
      }).map(entry => ({
        ...entry,
        sourceChunk: index,
        rawChunk: chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''),
        extractionTimestamp: new Date().toISOString()
      }));
      
      console.log(`✅ Extracted ${validEntries.length} valid entries from chunk ${index + 1}`);
      return validEntries;
      
    } catch (error) {
      console.error(`❌ Failed to process chunk ${index + 1}:`, error.message);
      return [];
    }
  }

  /**
   * Parse dictionary text using LLM
   * @param {string} text - Raw dictionary text
   * @returns {Promise<Object>} - Parsed results with entries and metadata
   */
  async parseDictionary(text) {
    console.log('🚀 Starting LLM-based dictionary parsing...');
    
    const chunks = this.chunkDictionaryText(text);
    const allEntries = [];
    const errors = [];
    
    for (let i = 0; i < chunks.length; i++) {
      try {
        const entries = await this.processChunk(chunks[i], i);
        allEntries.push(...entries);
        
        // Add a small delay between API calls to be respectful
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
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

    console.log(`\n🎉 LLM parsing completed!`);
    console.log(`📊 Results: ${allEntries.length} entries from ${chunks.length} chunks`);
    
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} chunks had errors`);
    }

    return {
      metadata: {
        parser: 'llm-dictionary-parser',
        model: this.model,
        ...stats
      },
      entries: allEntries,
      stats
    };
  }

  /**
   * Parse from JSON blocks (from extract-pdf-text.js output)
   * @param {Object} jsonData - JSON data with blocks array
   * @returns {Promise<Object>} - Parsed results
   */
  async parseFromBlocks(jsonData) {
    if (!jsonData.blocks || !Array.isArray(jsonData.blocks)) {
      throw new Error('Invalid JSON format. Expected "blocks" array.');
    }

    // Combine all blocks into text
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
 * Load input from file
 * @param {string} inputPath - Path to input file
 * @returns {string|Object} - Text content or JSON data
 */
function loadInput(inputPath) {
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputPath, 'utf8');

  if (inputPath.toLowerCase().endsWith('.json')) {
    try {
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ Error: Invalid JSON file: ${error.message}`);
      process.exit(1);
    }
  }

  return content;
}

/**
 * Save output to file
 * @param {string} outputPath - Output file path
 * @param {Object} data - Data to save
 */
function saveOutput(outputPath, data) {
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`💾 Results saved to: ${outputPath}`);
}

/**
 * Show usage information
 */
function showUsage() {
  console.log(`
🤖 LLM Dictionary Parser

Usage:
  node scripts/llm-dictionary-parser.js <input> [output-prefix]

Arguments:
  input          Text file (.txt) or JSON file (.json) with dictionary content
  output-prefix  Prefix for output files (default: input filename + '-llm-parsed')

Examples:
  node scripts/llm-dictionary-parser.js fijian-dict.txt
  node scripts/llm-dictionary-parser.js dictionary-blocks.json parsed-entries

Environment:
  ANTHROPIC_API_KEY  Required - Your Anthropic API key for Claude access

Features:
  - Uses Claude 3 Haiku for accurate Fijian dictionary entry extraction
  - Intelligent text chunking for optimal processing
  - Validates Fijian headwords and English definitions
  - Handles multiple entry formats and complex structures
  - Provides detailed statistics and error reporting
  - Cost-effective with retry logic and rate limiting

Prerequisites:
  - Node.js 16 or higher
  - Anthropic API key (sign up at https://anthropic.com)
  - @anthropic-ai/sdk package (included in project dependencies)
`);
}

/**
 * Main function
 */
async function main() {
  console.log('🤖 LLM Dictionary Parser Starting...\n');

  // Parse command line arguments
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    return;
  }

  if (process.argv.length < 3) {
    console.error('❌ Error: Input file is required');
    showUsage();
    process.exit(1);
  }

  const inputPath = process.argv[2];
  const outputPrefix = process.argv[3] || path.parse(inputPath).name + '-llm-parsed';

  try {
    // Load input data
    console.log(`📖 Loading input from: ${inputPath}`);
    const input = loadInput(inputPath);

    // Create parser instance
    const parser = new LLMDictionaryParser();

    // Parse dictionary
    let results;
    if (typeof input === 'string') {
      results = await parser.parseDictionary(input);
    } else {
      results = await parser.parseFromBlocks(input);
    }

    // Save results
    const outputFile = `${outputPrefix}.json`;
    saveOutput(outputFile, results);

    // Display summary
    console.log('\n📊 Summary:');
    console.log(`   - Input chunks: ${results.stats.totalChunks}`);
    console.log(`   - Processed chunks: ${results.stats.processedChunks}`);
    console.log(`   - Entries extracted: ${results.stats.entriesExtracted}`);
    console.log(`   - Model used: ${results.metadata.model}`);
    
    if (results.stats.errors.length > 0) {
      console.log(`   - Errors: ${results.stats.errors.length}`);
      console.log('\n⚠️  Errors encountered:');
      results.stats.errors.forEach(error => console.log(`     - ${error}`));
    }

    console.log('\n💡 Next steps:');
    console.log('   - Review the extracted entries for quality');
    console.log('   - Compare with regex-based parser results');
    console.log('   - Use structured JSON for further processing');

  } catch (error) {
    console.error('\n❌ Parsing failed:');
    console.error(`   ${error.message}`);
    console.error('\n🔧 Troubleshooting:');
    console.error('   - Ensure ANTHROPIC_API_KEY environment variable is set');
    console.error('   - Check that input file exists and is readable');
    console.error('   - Verify internet connection for API access');
    console.error('   - Try with a smaller input file to test API access');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for testing
module.exports = { LLMDictionaryParser };