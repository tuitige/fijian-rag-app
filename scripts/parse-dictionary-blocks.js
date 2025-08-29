#!/usr/bin/env node

/**
 * Dictionary Entry Parser for Extracted PDF Text Blocks
 * 
 * Processes the JSON output from extract-pdf-text.js to produce structured
 * dictionary entries with cleanup of headers, footers, and page numbers.
 * 
 * Usage:
 *   node scripts/parse-dictionary-blocks.js <input.json> [output-prefix]
 *   
 * Examples:
 *   node scripts/parse-dictionary-blocks.js dictionary.json
 *   node scripts/parse-dictionary-blocks.js fijian-dict.json parsed-entries
 * 
 * Input: JSON file from extract-pdf-text.js with text blocks
 * Output: Structured JSON entries ready for LLM ingestion
 */

const fs = require('fs');
const path = require('path');

/**
 * Dictionary Entry Parser Class
 * Handles the parsing logic for converting text blocks into structured entries
 */
class DictionaryBlockParser {
  constructor() {
    // Patterns for identifying dictionary entries
    this.entryPatterns = [
      // Pattern 1: Numbered entries with etymology "koko 2. (Eng.) n. definition"
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*(\d+)\.\s*(?:\(([^)]+)\))?\s*([nv]\.)?\s*(.+)$/,
      
      // Pattern 2: Simple numbered entries "koko 2. definition" 
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*(\d+)\.\s*(.+)$/,
      
      // Pattern 3: "word (etymology) pos. definition" format  
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*\(([^)]+)\)\s*([nv]\.)?\s*(.+)$/,
      
      // Pattern 4: "word pos. definition" format
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*([nv]\.)?\s*(.+)$/,
      
      // Pattern 5: "word - definition" format
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*[-–—]\s*(.+)$/,
      
      // Pattern 6: "word. definition" format
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\.\s*(.+)$/,
      
      // Pattern 7: "word: definition" format
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+):\s*(.+)$/
    ];

    // Patterns for cleaning OCR artifacts and formatting
    this.cleaningPatterns = [
      { pattern: /\s+/g, replacement: ' ' }, // Multiple spaces
      { pattern: /[""]/g, replacement: '"' }, // Smart quotes
      { pattern: /['']/g, replacement: "'" }, // Smart apostrophes
      { pattern: /…/g, replacement: '...' }, // Ellipsis
      { pattern: /\b[Il]\b/g, replacement: '1' }, // OCR 1/l/I confusion in numbers
      { pattern: /\b[O0]\b/g, replacement: 'O' }, // OCR O/0 confusion in words
      { pattern: /^\s*[|†*•]\s*/, replacement: '' }, // Remove bullet points and artifacts
      { pattern: /\s*\[\?\]\s*/g, replacement: ' ' }, // Remove OCR uncertainty markers
    ];

    // Patterns for headers, footers, and page numbers to remove
    this.headerFooterPatterns = [
      /^FIJIAN\s*[–-]\s*ENGLISH\s*DICTIONARY.*$/i,
      /^R\.\s*GATTY\s*$/i,
      /^\d+$/, // Standalone page numbers
      /^Page\s+\d+/i,
      /^---\s*PAGE\s+\d+\s*---/i,
      /^\s*[A-Z]\s*$/, // Single letter section dividers
    ];

    // Patterns for etymology markers
    this.etymologyPatterns = [
      /\(Eng\.\)/i,  // English derived
      /\(Lau\)/i,    // Lau dialect
      /\(Bau\)/i,    // Bau dialect
      /\(Fij\.\)/i,  // Fijian origin
      /\(archaic\)/i // Archaic usage
    ];
  }

  /**
   * Parse JSON blocks into structured dictionary entries
   */
  async parseBlocks(jsonData) {
    console.log('🔍 Starting dictionary block parsing...');
    
    const { metadata, blocks } = jsonData;
    const entries = [];
    const stats = {
      totalBlocks: blocks.length,
      processedBlocks: 0,
      entriesFound: 0,
      malformedEntries: 0,
      cleanedLines: 0,
      errors: []
    };

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const block = blocks[blockIndex];
      const blockEntries = this.parseBlock(block.block, blockIndex);
      
      entries.push(...blockEntries.entries);
      stats.processedBlocks++;
      stats.entriesFound += blockEntries.entries.length;
      stats.malformedEntries += blockEntries.malformed;
      stats.cleanedLines += blockEntries.cleanedLines;
      stats.errors.push(...blockEntries.errors);
    }

    // Calculate confidence distribution
    const confidenceDistribution = { high: 0, medium: 0, low: 0 };
    entries.forEach(entry => {
      if (entry.confidence >= 90) confidenceDistribution.high++;
      else if (entry.confidence >= 70) confidenceDistribution.medium++;
      else confidenceDistribution.low++;
    });

    console.log(`✅ Parsing completed: ${stats.entriesFound} entries found from ${stats.processedBlocks} blocks`);
    
    return {
      metadata: {
        ...metadata,
        parsing_timestamp: new Date().toISOString(),
        parser_version: "1.0.0"
      },
      entries,
      stats: {
        ...stats,
        confidenceDistribution
      }
    };
  }

  /**
   * Parse a single text block into dictionary entries
   */
  parseBlock(blockText, blockIndex) {
    const lines = blockText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const entries = [];
    const errors = [];
    let malformed = 0;
    let cleanedLines = 0;
    let currentEntry = null;
    let continuationLines = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      // Skip headers, footers, and page numbers
      if (this.isHeaderFooterOrPageNumber(line)) {
        cleanedLines++;
        continue;
      }

      // Clean the line
      const cleanedLine = this.cleanLine(line);
      if (cleanedLine !== line) {
        cleanedLines++;
      }

      // Try to parse as new entry
      const entryMatch = this.tryParseEntry(cleanedLine);
      
      if (entryMatch) {
        // Save previous entry if exists
        if (currentEntry) {
          const finalEntry = this.finalizeEntry(currentEntry, continuationLines);
          if (finalEntry) {
            entries.push(finalEntry);
          } else {
            malformed++;
          }
        }

        // Start new entry
        currentEntry = {
          headword: entryMatch.headword,
          entryNumber: entryMatch.entryNumber,
          partOfSpeech: entryMatch.partOfSpeech,
          etymology: entryMatch.etymology,
          definition: entryMatch.definition,
          sourceBlock: blockIndex,
          sourceLine: lineIndex,
          rawLine: cleanedLine,
          pattern: entryMatch.patternIndex
        };
        continuationLines = [];
      } else if (currentEntry && this.isContinuationLine(cleanedLine)) {
        // Add to current entry as continuation
        continuationLines.push(cleanedLine);
      } else if (currentEntry) {
        // Unmatched line while we have a current entry - possible malformed content
        continuationLines.push(cleanedLine);
      } else {
        // Standalone unmatched line
        errors.push(`Block ${blockIndex}, Line ${lineIndex}: "${cleanedLine.substring(0, 50)}..."`);
      }
    }

    // Finalize last entry
    if (currentEntry) {
      const finalEntry = this.finalizeEntry(currentEntry, continuationLines);
      if (finalEntry) {
        entries.push(finalEntry);
      } else {
        malformed++;
      }
    }

    return { entries, malformed, cleanedLines, errors };
  }

  /**
   * Check if line is a header, footer, or page number
   */
  isHeaderFooterOrPageNumber(line) {
    return this.headerFooterPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Clean line text of OCR artifacts
   */
  cleanLine(text) {
    let cleaned = text;
    
    for (const { pattern, replacement } of this.cleaningPatterns) {
      cleaned = cleaned.replace(pattern, replacement);
    }
    
    return cleaned.trim();
  }

  /**
   * Try to parse a line as a dictionary entry
   */
  tryParseEntry(line) {
    // First check if this looks like a dictionary entry before applying patterns
    if (!this.looksLikeDictionaryEntry(line)) {
      return null;
    }

    for (let i = 0; i < this.entryPatterns.length; i++) {
      const pattern = this.entryPatterns[i];
      const match = line.match(pattern);
      
      if (match) {
        return this.extractEntryData(match, i);
      }
    }
    return null;
  }

  /**
   * Check if a line looks like it could be a dictionary entry
   */
  looksLikeDictionaryEntry(line) {
    // Must start with a word character
    if (!/^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(line)) return false;
    
    // Skip obvious non-entries
    if (/^(the|and|or|but|for|in|on|at|to|from|with|by|of|a|an|is|are|was|were|been|being|have|has|had|do|does|did|will|would|could|should|may|might|can|cannot|not|no|yes|this|that|these|those|here|there|where|when|why|how|what|who|which|some|any|all|each|every|more|most|less|least|much|many|few|little|big|small|large|great|good|bad|best|worst|better|new|old|first|last|next|previous|same|different|other|another|such|very|quite|rather|too|so|just|only|even|still|yet|already|now|then|today|yesterday|tomorrow)\s/i.test(line)) return false;
    
    // Must contain some dictionary-like markers
    const hasEntryMarkers = /(\d+\.|[nv]\.|[-–—:.]|\([^)]+\))/.test(line);
    const hasReasonableLength = line.length >= 4 && line.length <= 200;
    const startsWithFijianLikeWord = /^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]{2,}/.test(line);
    
    return hasEntryMarkers && hasReasonableLength && startsWithFijianLikeWord;
  }

  /**
   * Extract entry data from regex match
   */
  extractEntryData(match, patternIndex) {
    const result = {
      headword: match[1],
      patternIndex,
      entryNumber: null,
      etymology: null,
      partOfSpeech: null,
      definition: null
    };

    // Pattern-specific extraction
    switch (patternIndex) {
      case 0: // Numbered with etymology: "koko 2. (Eng.) n. definition"
        result.entryNumber = parseInt(match[2]);
        result.etymology = match[3];
        result.partOfSpeech = match[4];
        result.definition = match[5];
        break;
      case 1: // Simple numbered: "koko 2. definition"
        result.entryNumber = parseInt(match[2]);
        result.definition = match[3];
        break;
      case 2: // Etymology + POS: "word (etymology) pos. definition"
        result.etymology = match[2];
        result.partOfSpeech = match[3];
        result.definition = match[4];
        break;
      case 3: // POS + definition: "word pos. definition"
        result.partOfSpeech = match[2];
        result.definition = match[3];
        break;
      case 4: // Dash format: "word - definition"
        result.definition = match[2];
        break;
      case 5: // Dot format: "word. definition"
        result.definition = match[2];
        break;
      case 6: // Colon format: "word: definition"
        result.definition = match[2];
        break;
    }

    return result;
  }

  /**
   * Check if line is a continuation of the current entry
   */
  isContinuationLine(line) {
    // Continuation lines typically:
    // - Start with lowercase or are indented
    // - Don't match any entry patterns
    // - Are not headers/footers
    // - Contain substantive content
    
    if (line.length < 3) return false;
    if (this.isHeaderFooterOrPageNumber(line)) return false;
    if (this.tryParseEntry(line)) return false;
    
    // More selective heuristic: 
    // - Lines that start with lowercase are likely continuations
    // - Lines that are clearly mid-sentence (no capital start + no period end typically)
    // - But exclude lines that look like they could be new entries
    return /^[a-z]/.test(line) || 
           (/^[A-Z]/.test(line) && !/^[A-Z][a-z]+\s*(\d+\.|\([^)]+\)|[nv]\.|[-–—:]|\.)/.test(line));
  }

  /**
   * Finalize an entry with its continuation lines
   */
  finalizeEntry(entry, continuationLines) {
    if (!entry.headword || !entry.definition) {
      return null; // Malformed entry
    }

    // Combine definition with continuation lines
    let fullDefinition = entry.definition;
    if (continuationLines.length > 0) {
      fullDefinition += ' ' + continuationLines.join(' ');
    }

    // Calculate confidence score
    const confidence = this.calculateConfidence(entry, continuationLines);

    // Extract additional features
    const usageExamples = this.extractUsageExamples(fullDefinition);
    const crossReferences = this.extractCrossReferences(fullDefinition);
    const culturalNotes = this.extractCulturalNotes(fullDefinition);

    return {
      headword: entry.headword,
      definition: fullDefinition.trim(),
      partOfSpeech: this.expandPartOfSpeech(entry.partOfSpeech),
      etymology: entry.etymology,
      entryNumber: entry.entryNumber,
      usageExamples,
      crossReferences,
      culturalNotes,
      confidence,
      sourceMetadata: {
        sourceBlock: entry.sourceBlock,
        sourceLine: entry.sourceLine,
        rawLine: entry.rawLine,
        pattern: entry.pattern,
        continuationLines: continuationLines.length
      }
    };
  }

  /**
   * Calculate confidence score for an entry
   */
  calculateConfidence(entry, continuationLines) {
    let confidence = 50; // Base score

    // Boost for clear patterns
    if (entry.entryNumber) confidence += 20;
    if (entry.etymology) confidence += 15;
    if (entry.partOfSpeech) confidence += 10;
    
    // Boost for substantial definition
    if (entry.definition && entry.definition.length > 20) confidence += 10;
    if (continuationLines.length > 0) confidence += 5;
    
    // Penalty for very short or very long entries
    const totalLength = entry.definition.length + continuationLines.join(' ').length;
    if (totalLength < 10) confidence -= 20;
    if (totalLength > 500) confidence -= 10;

    return Math.min(Math.max(confidence, 0), 100);
  }

  /**
   * Expand part of speech abbreviations
   */
  expandPartOfSpeech(abbrev) {
    if (!abbrev) return null;
    
    const expansions = {
      'n.': 'noun',
      'v.': 'verb',
      'adj.': 'adjective',
      'adv.': 'adverb',
      'prep.': 'preposition',
      'conj.': 'conjunction',
      'interj.': 'interjection'
    };

    return expansions[abbrev.toLowerCase()] || abbrev;
  }

  /**
   * Extract usage examples from definition text
   */
  extractUsageExamples(text) {
    const examples = [];
    
    // Look for sentences in italics or quotes
    const italicMatches = text.match(/\b[A-Z][^.!?]*[.!?]/g);
    if (italicMatches) {
      examples.push(...italicMatches.filter(ex => ex.length > 10 && ex.length < 100));
    }

    return examples.slice(0, 3); // Limit to 3 examples
  }

  /**
   * Extract cross-references from definition text
   */
  extractCrossReferences(text) {
    const refs = [];
    
    // Look for "see also", "cf.", etc.
    const refMatches = text.match(/(?:see also|cf\.|compare|syn\.|synonym)\s+([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)/gi);
    if (refMatches) {
      refMatches.forEach(match => {
        const word = match.split(/\s+/).pop();
        if (word && word.length > 2) {
          refs.push(word.toLowerCase());
        }
      });
    }

    return [...new Set(refs)]; // Remove duplicates
  }

  /**
   * Extract cultural notes from definition text
   */
  extractCulturalNotes(text) {
    const culturalIndicators = [
      /traditional/i,
      /cultural/i,
      /ceremonial/i,
      /ritual/i,
      /custom/i,
      /feast/i,
      /tribal/i,
      /sacred/i
    ];

    const hasCulturalContent = culturalIndicators.some(pattern => pattern.test(text));
    return hasCulturalContent ? text.substring(0, 200) + '...' : null;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Dictionary Block Parser Starting...\n');

  // Parse command line arguments
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    return;
  }

  if (process.argv.length < 3) {
    console.error('❌ Error: Input JSON file is required');
    showUsage();
    process.exit(1);
  }

  const inputJson = process.argv[2];
  const outputPrefix = process.argv[3] || path.parse(inputJson).name + '-parsed';

  try {
    // Validate input file
    if (!fs.existsSync(inputJson)) {
      console.error(`❌ Error: Input file not found: ${inputJson}`);
      process.exit(1);
    }

    if (!inputJson.toLowerCase().endsWith('.json')) {
      console.error('❌ Error: Input file must be a JSON file');
      process.exit(1);
    }

    // Load JSON data
    console.log(`📖 Loading JSON data from: ${inputJson}`);
    const jsonData = JSON.parse(fs.readFileSync(inputJson, 'utf8'));

    if (!jsonData.blocks || !Array.isArray(jsonData.blocks)) {
      console.error('❌ Error: Invalid JSON format. Expected "blocks" array.');
      process.exit(1);
    }

    console.log(`✅ Loaded ${jsonData.blocks.length} text blocks`);

    // Parse blocks
    const parser = new DictionaryBlockParser();
    const parsedData = await parser.parseBlocks(jsonData);

    // Save results
    const outputFile = `${outputPrefix}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(parsedData, null, 2), 'utf8');
    console.log(`💾 Parsed entries saved to: ${outputFile}`);

    // Display summary
    console.log('\n🎉 Parsing completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Input blocks: ${parsedData.stats.totalBlocks}`);
    console.log(`   - Entries found: ${parsedData.stats.entriesFound}`);
    console.log(`   - Malformed entries: ${parsedData.stats.malformedEntries}`);
    console.log(`   - Lines cleaned: ${parsedData.stats.cleanedLines}`);
    console.log(`   - Confidence distribution:`);
    console.log(`     • High (90%+): ${parsedData.stats.confidenceDistribution.high}`);
    console.log(`     • Medium (70-89%): ${parsedData.stats.confidenceDistribution.medium}`);
    console.log(`     • Low (<70%): ${parsedData.stats.confidenceDistribution.low}`);

    // Show sample entries
    if (parsedData.entries.length > 0) {
      console.log('\n🔍 Sample entries:');
      parsedData.entries.slice(0, 3).forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.headword}${entry.entryNumber ? ' ' + entry.entryNumber : ''}`);
        console.log(`      Definition: ${entry.definition.substring(0, 60)}...`);
        console.log(`      Confidence: ${entry.confidence}%`);
        if (entry.partOfSpeech) console.log(`      Part of Speech: ${entry.partOfSpeech}`);
        if (entry.etymology) console.log(`      Etymology: ${entry.etymology}`);
        console.log('');
      });
    }

    console.log('\n💡 Next steps:');
    console.log('   - Review the parsed entries for quality');
    console.log('   - Use the structured JSON for LLM ingestion');
    console.log('   - The entries are ready for database indexing');

  } catch (error) {
    console.error('\n❌ Parsing failed:');
    console.error(`   ${error.message}`);
    console.error('\n🔧 Troubleshooting:');
    console.error('   - Ensure the JSON file is valid and from extract-pdf-text.js');
    console.error('   - Check that the JSON contains a "blocks" array');
    console.error('   - Verify the file is not corrupted');
    process.exit(1);
  }
}

/**
 * Show usage information
 */
function showUsage() {
  console.log(`
📚 Dictionary Block Parser

Usage:
  node scripts/parse-dictionary-blocks.js <input.json> [output-prefix]

Arguments:
  input.json     JSON file from extract-pdf-text.js with text blocks
  output-prefix  Prefix for output files (default: input filename + '-parsed')

Examples:
  node scripts/parse-dictionary-blocks.js dictionary.json
  node scripts/parse-dictionary-blocks.js fijian-dict.json parsed-entries

Output:
  <prefix>.json  Structured dictionary entries ready for LLM ingestion

Features:
  - Removes headers, footers, and page numbers
  - Detects multiple dictionary entry formats
  - Cleans OCR artifacts and formatting issues
  - Extracts etymology, part of speech, and definitions
  - Provides confidence scoring for each entry
  - Identifies usage examples and cultural notes
  - Modular and testable design

Prerequisites:
  - Node.js 16 or higher
  - JSON file from extract-pdf-text.js script
`);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for testing
module.exports = { DictionaryBlockParser };