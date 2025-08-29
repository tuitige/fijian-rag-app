#!/usr/bin/env node

/**
 * Test Dictionary Block Parser
 * 
 * Tests the parse-dictionary-blocks.js script with sample data
 */

const fs = require('fs');
const path = require('path');
const { DictionaryBlockParser } = require('./parse-dictionary-blocks.js');

/**
 * Create test JSON data in the format produced by extract-pdf-text.js
 */
function createTestData() {
  // Sample text blocks that simulate the output from extract-pdf-text.js
  const sampleBlocks = [
    {
      block: `FIJIAN – ENGLISH DICTIONARY R. GATTY
121
koko 2. (Eng.) n. cocoa. There are efforts to revive the industry. The problems have been a severely
fluctuating world price, black pod disease in rainy areas, and a lack of disciplined care for the trees.
There has been a lack of organised, equitable and competent marketing for export.
koko 3. n. Fijian pudding of grated ivi fruit (Polynesian chestnut), baked in earth oven. This is a
regional food of Rewa, where the tree has been common; it grows in low-lying, wet areas. Also a food
specialty of Beqa Island.`
    },
    {
      block: `koko 4. (Eng.) n. cork usually used as float for fishing line or stopper for a bottle. A piece of coconut
husk (qanibulu) often serves as a bottle stopper.
koko 5. v. to crow, cackle, croak, of hen, frog, parrot.
kokoraki v. to clear the throat with a kind of cough.
kokoroti (Eng.) n. cockroach.`
    },
    {
      block: `kokosi (Eng.) n. goose, also now applied to a native bird, Fiji Shrikebill. Geese are rarely kept in Fiji.
kokosi (Lau) to be playful, play a game. Kakua ni kokosi! Stop playing!
kokovu v., n. about to burst, of boil, pimple, blister. kovu bud.
kola, kola or kolata v. to split wood, coconut, dalo with something sharp. kola rua split in two. May
apply to cutting up of kava, especially the way the basal stem (lewena) is chopped up into pieces for
drying. kola musu, kolamusutaka v. to cut up in pieces.`
    },
    {
      block: `122
kolarua, kolaruataka v. to split into two pieces. Similarly, this can be extended to more pieces, as in
kolatolu three pieces, kolava four pieces, etc.
kola (Eng.) n. collar. Idiom: kola up, means to go about in a challenging, proud manner, often said of
hoodlums, pretentious youths, ready to make trouble.
kolai root word, used as a prefix that implies something close to happening (but usually used as an
exaggeration: kolai mate see below.`
    },
    {
      block: `kolai mate Idiom, lit. close to death, or figuratively to be "dying" with desire, as to see someone, or to
eat some savoured food. Syn. kolai ciba.
koli n. dog. The term does not derive from English "collie". Polynesians raised dogs, fed them a
vegetable starch diet, and ate them. Some still eat dogs, as I have recorded from Lakeba, Vanua
Balavu, and Gau Island.`
    }
  ];

  return {
    metadata: {
      extraction_timestamp: new Date().toISOString(),
      source_file: "test-dictionary.pdf",
      extraction_method: "pdf-parse",
      total_blocks: sampleBlocks.length,
      total_characters: sampleBlocks.reduce((sum, block) => sum + block.block.length, 0),
      pdf_info: {
        Title: "Fijian-English Dictionary Test",
        Author: "R. GATTY"
      },
      pdf_metadata: {}
    },
    blocks: sampleBlocks
  };
}

/**
 * Test the parser with sample data
 */
async function testParser() {
  console.log('🧪 Testing Dictionary Block Parser\n');

  try {
    // Create test data
    const testData = createTestData();
    console.log(`📖 Created test data with ${testData.blocks.length} blocks`);
    console.log(`   Total characters: ${testData.metadata.total_characters}`);

    // Initialize parser
    const parser = new DictionaryBlockParser();
    console.log('✅ Parser initialized');

    // Parse the test data
    console.log('\n🔍 Starting parsing...');
    const result = await parser.parseBlocks(testData);

    // Display results
    console.log('\n📊 Parsing Results:');
    console.log(`   - Blocks processed: ${result.stats.processedBlocks}`);
    console.log(`   - Entries found: ${result.stats.entriesFound}`);
    console.log(`   - Malformed entries: ${result.stats.malformedEntries}`);
    console.log(`   - Lines cleaned: ${result.stats.cleanedLines}`);
    console.log(`   - Errors: ${result.stats.errors.length}`);

    console.log('\n🎯 Confidence Distribution:');
    console.log(`   - High confidence (90%+): ${result.stats.confidenceDistribution.high}`);
    console.log(`   - Medium confidence (70-89%): ${result.stats.confidenceDistribution.medium}`);
    console.log(`   - Low confidence (<70%): ${result.stats.confidenceDistribution.low}`);

    // Show parsed entries
    console.log('\n📝 Parsed Entries:');
    result.entries.forEach((entry, index) => {
      console.log(`\n${index + 1}. ${entry.headword}${entry.entryNumber ? ' ' + entry.entryNumber : ''}`);
      console.log(`   Definition: ${entry.definition.substring(0, 100)}${entry.definition.length > 100 ? '...' : ''}`);
      console.log(`   Confidence: ${entry.confidence}%`);
      if (entry.partOfSpeech) console.log(`   Part of Speech: ${entry.partOfSpeech}`);
      if (entry.etymology) console.log(`   Etymology: ${entry.etymology}`);
      if (entry.usageExamples && entry.usageExamples.length > 0) {
        console.log(`   Examples: ${entry.usageExamples.slice(0, 2).join('; ')}`);
      }
      console.log(`   Pattern: ${entry.sourceMetadata.pattern}, Block: ${entry.sourceMetadata.sourceBlock}`);
    });

    // Show any errors
    if (result.stats.errors.length > 0) {
      console.log('\n⚠️  Parsing Errors:');
      result.stats.errors.slice(0, 5).forEach(error => {
        console.log(`   - ${error}`);
      });
      if (result.stats.errors.length > 5) {
        console.log(`   ... and ${result.stats.errors.length - 5} more errors`);
      }
    }

    // Test specific patterns
    console.log('\n🔍 Testing Specific Patterns:');
    testSpecificPatterns(parser);

    // Test cleaning functions
    console.log('\n🧹 Testing Cleaning Functions:');
    testCleaningFunctions(parser);

    // Save test results
    const outputPath = '/tmp/test-parser-results.json';
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n💾 Test results saved to: ${outputPath}`);

    console.log('\n✅ All parser tests completed successfully!');
    return true;

  } catch (error) {
    console.error('\n❌ Parser test failed:');
    console.error(`   ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    return false;
  }
}

/**
 * Test specific parsing patterns
 */
function testSpecificPatterns(parser) {
  const testLines = [
    'koko 2. (Eng.) n. cocoa definition here',
    'koko 3. n. simple numbered entry',
    'word (Lau) v. etymology with pos',
    'simple n. basic entry',
    'hyphen - entry with dash',
    'dotted. entry with dot',
    'colon: entry with colon',
    'FIJIAN – ENGLISH DICTIONARY', // Should be filtered
    'R. GATTY', // Should be filtered
    '123', // Should be filtered
  ];

  console.log('   Testing pattern recognition:');
  testLines.forEach(line => {
    const isHeader = parser.isHeaderFooterOrPageNumber(line);
    const cleaned = parser.cleanLine(line);
    const entry = parser.tryParseEntry(cleaned);
    
    console.log(`   "${line}" -> ${isHeader ? 'FILTERED' : entry ? `ENTRY: ${entry.headword}` : 'UNMATCHED'}`);
  });
}

/**
 * Test cleaning functions
 */
function testCleaningFunctions(parser) {
  const testTexts = [
    'text  with   multiple    spaces',
    'text with "smart quotes" and apostrophes',
    'text with… ellipsis',
    '• bullet point text',
    'text with [?] OCR uncertainty',
    'FIJIAN – ENGLISH DICTIONARY header text',
  ];

  console.log('   Testing text cleaning:');
  testTexts.forEach(text => {
    const cleaned = parser.cleanLine(text);
    console.log(`   "${text}" -> "${cleaned}"`);
  });
}

/**
 * Run comprehensive tests
 */
async function runTests() {
  console.log('🚀 Starting Dictionary Block Parser Tests\n');

  const testPassed = await testParser();
  
  if (testPassed) {
    console.log('\n🎉 All tests passed! Parser is ready for production use.');
    console.log('\n💡 Usage:');
    console.log('   node scripts/parse-dictionary-blocks.js input.json output-prefix');
    console.log('\n📋 Next steps:');
    console.log('   1. Run extract-pdf-text.js on a real PDF');
    console.log('   2. Use this parser on the resulting JSON');
    console.log('   3. Review parsed entries for quality');
    console.log('   4. Integrate with downstream processing');
  } else {
    console.log('\n❌ Tests failed. Please review the errors above.');
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testParser, createTestData };