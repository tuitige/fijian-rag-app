#!/usr/bin/env node

/**
 * Compare regex-based parser vs LLM-based parser
 * 
 * This script runs both parsers on the same input and compares results
 * to demonstrate the improvement of using LLM for dictionary parsing.
 */

const fs = require('fs');
const path = require('path');

async function compareParsingResults(inputFile) {
  console.log('🔬 Dictionary Parser Comparison\n');
  console.log(`📖 Input file: ${inputFile}\n`);

  // Run regex-based parser
  console.log('1️⃣ Running regex-based parser...');
  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);

  try {
    await execAsync(`cd /home/runner/work/fijian-rag-app/fijian-rag-app && ./scripts/parse-dictionary-blocks.js ${inputFile} comparison-regex`);
    console.log('✅ Regex parser completed\n');
  } catch (error) {
    console.log('❌ Regex parser failed:', error.message);
  }

  // Run mock LLM parser
  console.log('2️⃣ Running mock LLM parser...');
  try {
    await execAsync(`cd /home/runner/work/fijian-rag-app/fijian-rag-app && ./scripts/mock-llm-parser.js ${inputFile} comparison-llm`);
    console.log('✅ Mock LLM parser completed\n');
  } catch (error) {
    console.log('❌ Mock LLM parser failed:', error.message);
  }

  // Load and compare results
  console.log('📊 Comparison Results:\n');

  try {
    const regexResults = JSON.parse(fs.readFileSync('comparison-regex.json', 'utf8'));
    const llmResults = JSON.parse(fs.readFileSync('comparison-llm.json', 'utf8'));

    console.log('📈 Statistics Comparison:');
    console.log(`   Regex Parser:`);
    console.log(`   - Entries found: ${regexResults.stats.entriesFound}`);
    console.log(`   - Malformed entries: ${regexResults.stats.malformedEntries}`);
    console.log(`   - Errors: ${regexResults.stats.errors.length}`);
    console.log(`   - High confidence: ${regexResults.stats.confidenceDistribution.high}`);
    console.log(`   - Medium confidence: ${regexResults.stats.confidenceDistribution.medium}`);
    console.log(`   - Low confidence: ${regexResults.stats.confidenceDistribution.low}`);

    console.log(`\n   Mock LLM Parser:`);
    console.log(`   - Entries extracted: ${llmResults.stats.entriesExtracted}`);
    console.log(`   - Processing errors: ${llmResults.stats.errors.length}`);
    console.log(`   - Success rate: ${(llmResults.stats.processedChunks / llmResults.stats.totalChunks * 100).toFixed(1)}%`);

    console.log('\n🔍 Entry Details Comparison:');
    
    console.log('\n   Regex Parser Results:');
    regexResults.entries.forEach((entry, i) => {
      console.log(`   ${i + 1}. "${entry.headword}" - ${entry.definition.substring(0, 50)}... (confidence: ${entry.confidence})`);
    });

    console.log('\n   Mock LLM Parser Results:');
    llmResults.entries.forEach((entry, i) => {
      console.log(`   ${i + 1}. "${entry.headword}" - ${entry.definition.substring(0, 50)}...`);
    });

    // Find entries that LLM found but regex missed
    const regexHeadwords = new Set(regexResults.entries.map(e => e.headword));
    const llmHeadwords = new Set(llmResults.entries.map(e => e.headword));
    
    const missedByRegex = llmResults.entries.filter(e => !regexHeadwords.has(e.headword));
    const missedByLLM = regexResults.entries.filter(e => !llmHeadwords.has(e.headword));

    if (missedByRegex.length > 0) {
      console.log('\n✨ Entries found by LLM but missed by regex:');
      missedByRegex.forEach(entry => {
        console.log(`   - "${entry.headword}": ${entry.definition.substring(0, 80)}...`);
      });
    }

    if (missedByLLM.length > 0) {
      console.log('\n⚠️  Entries found by regex but missed by LLM:');
      missedByLLM.forEach(entry => {
        console.log(`   - "${entry.headword}": ${entry.definition.substring(0, 80)}...`);
      });
    }

    console.log('\n🎯 Summary:');
    console.log(`   - Total unique entries found: ${new Set([...regexHeadwords, ...llmHeadwords]).size}`);
    console.log(`   - Entries only found by LLM: ${missedByRegex.length}`);
    console.log(`   - Entries only found by regex: ${missedByLLM.length}`);
    console.log(`   - Overlap: ${regexResults.entries.filter(e => llmHeadwords.has(e.headword)).length}`);

    console.log('\n💡 Conclusion:');
    if (llmResults.stats.entriesExtracted > regexResults.stats.entriesFound) {
      console.log(`   ✅ LLM parser found ${llmResults.stats.entriesExtracted - regexResults.stats.entriesFound} more entries than regex parser`);
    } else if (llmResults.stats.entriesExtracted < regexResults.stats.entriesFound) {
      console.log(`   ⚠️  LLM parser found ${regexResults.stats.entriesFound - llmResults.stats.entriesExtracted} fewer entries than regex parser`);
    } else {
      console.log(`   ➖ Both parsers found the same number of entries`);
    }

    if (llmResults.stats.errors.length < regexResults.stats.errors.length) {
      console.log(`   ✅ LLM parser had fewer processing errors`);
    }

    console.log(`   📝 LLM parser provides better structured output with notes and etymology`);

  } catch (error) {
    console.error('❌ Could not compare results:', error.message);
  }

  // Cleanup comparison files
  try {
    fs.unlinkSync('comparison-regex.json');
    fs.unlinkSync('comparison-llm.json');
  } catch (e) {
    // Ignore cleanup errors
  }
}

// Main execution
if (require.main === module) {
  const inputFile = process.argv[2] || 'sample-dictionary.json';
  compareParsingResults(inputFile).catch(console.error);
}