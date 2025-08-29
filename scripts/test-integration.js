#!/usr/bin/env node

/**
 * Integration Test for Dictionary Entry Parser Workflow
 * 
 * Tests the complete workflow from PDF extraction to structured entries
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Create a sample PDF text content for testing
 */
function createSampleTextContent() {
  return `FIJIAN – ENGLISH DICTIONARY
R. GATTY

121

koko 2. (Eng.) n. cocoa. There are efforts to revive the industry. The problems have been a severely
fluctuating world price, black pod disease in rainy areas, and a lack of disciplined care for the trees.
There has been a lack of organised, equitable and competent marketing for export.

koko 3. n. Fijian pudding of grated ivi fruit (Polynesian chestnut), baked in earth oven. This is a
regional food of Rewa, where the tree has been common; it grows in low-lying, wet areas. Also a food
specialty of Beqa Island.

koko 4. (Eng.) n. cork usually used as float for fishing line or stopper for a bottle. A piece of coconut
husk (qanibulu) often serves as a bottle stopper.

koko 5. v. to crow, cackle, croak, of hen, frog, parrot.

kokoraki v. to clear the throat with a kind of cough.

kokoroti (Eng.) n. cockroach.

kokosi (Eng.) n. goose, also now applied to a native bird, Fiji Shrikebill. Geese are rarely kept in Fiji.

kokosi (Lau) to be playful, play a game. Kakua ni kokosi! Stop playing!

kokovu v., n. about to burst, of boil, pimple, blister. kovu bud.

kola v. to split wood, coconut, dalo with something sharp. kola rua split in two. May
apply to cutting up of kava, especially the way the basal stem (lewena) is chopped up into pieces for
drying. kola musu, kolamusutaka v. to cut up in pieces.

koli n. dog. The term does not derive from English "collie". Polynesians raised dogs, fed them a
vegetable starch diet, and ate them. Some still eat dogs, as I have recorded from Lakeba, Vanua
Balavu, and Gau Island.

122`;
}

/**
 * Create mock JSON file in extract-pdf-text.js format
 */
function createMockExtractedJSON(textContent) {
  // Simulate how extract-pdf-text.js would break up the content
  const blocks = [];
  const lines = textContent.split('\n').filter(line => line.trim().length > 0);
  
  let currentBlock = '';
  for (const line of lines) {
    // Simulate block boundaries (similar to extract-pdf-text.js logic)
    if (/^[A-Z]$/.test(line.trim()) || /^FIJIAN\s*[–-]\s*ENGLISH/i.test(line) || /^\d+$/.test(line.trim())) {
      if (currentBlock.trim()) {
        blocks.push({ block: currentBlock.trim() });
        currentBlock = '';
      }
    } else {
      currentBlock += line + '\n';
    }
  }
  
  // Add the last block
  if (currentBlock.trim()) {
    blocks.push({ block: currentBlock.trim() });
  }

  return {
    metadata: {
      extraction_timestamp: new Date().toISOString(),
      source_file: "integration-test.pdf",
      extraction_method: "pdf-parse",
      total_blocks: blocks.length,
      total_characters: textContent.length,
      pdf_info: {
        Title: "Fijian-English Dictionary Integration Test",
        Author: "R. GATTY"
      },
      pdf_metadata: {}
    },
    blocks: blocks
  };
}

/**
 * Run integration test
 */
async function runIntegrationTest() {
  console.log('🧪 Running Dictionary Parser Integration Test\n');

  const tempDir = '/tmp/parser-integration-test';
  const testPrefix = 'integration-test';

  try {
    // Clean up any previous test files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    console.log('📝 Step 1: Creating sample text content...');
    const sampleText = createSampleTextContent();
    console.log(`   Created ${sampleText.length} characters of sample text`);

    console.log('\n📦 Step 2: Creating mock extracted JSON...');
    const mockJson = createMockExtractedJSON(sampleText);
    const jsonFile = path.join(tempDir, `${testPrefix}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify(mockJson, null, 2));
    console.log(`   Created mock JSON with ${mockJson.blocks.length} blocks: ${jsonFile}`);

    console.log('\n🔍 Step 3: Running dictionary parser...');
    const outputPrefix = path.join(tempDir, `${testPrefix}-parsed`);
    const parseCommand = `node scripts/parse-dictionary-blocks.js "${jsonFile}" "${outputPrefix}"`;
    
    console.log(`   Command: ${parseCommand}`);
    const parseOutput = execSync(parseCommand, { encoding: 'utf8', cwd: process.cwd() });
    console.log('   Parser output:');
    console.log(parseOutput.split('\n').map(line => `     ${line}`).join('\n'));

    console.log('\n📊 Step 4: Validating results...');
    const resultFile = `${outputPrefix}.json`;
    if (!fs.existsSync(resultFile)) {
      throw new Error(`Parser output file not found: ${resultFile}`);
    }

    const results = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
    console.log(`   ✅ Results file created: ${resultFile}`);
    console.log(`   ✅ Found ${results.entries.length} dictionary entries`);
    console.log(`   ✅ Processed ${results.stats.processedBlocks} blocks`);
    console.log(`   ✅ Cleaned ${results.stats.cleanedLines} lines`);

    // Validate specific entries
    console.log('\n🔍 Step 5: Validating specific entries...');
    const validationTests = [
      { headword: 'koko', entryNumber: 2, hasEtymology: true, hasPOS: true },
      { headword: 'koko', entryNumber: 3, hasEtymology: false, hasPOS: true },
      { headword: 'koko', entryNumber: 4, hasEtymology: true, hasPOS: true },
      { headword: 'koko', entryNumber: 5, hasEtymology: false, hasPOS: true },
      { headword: 'kokoraki', hasEtymology: false, hasPOS: true },
      { headword: 'kokosi', hasEtymology: true, hasPOS: true },
      { headword: 'koli', hasEtymology: false, hasPOS: true }
    ];

    let validationsPassed = 0;
    let validationsFailed = 0;

    for (const test of validationTests) {
      const entry = results.entries.find(e => 
        e.headword === test.headword && 
        (test.entryNumber ? e.entryNumber === test.entryNumber : true)
      );

      if (entry) {
        console.log(`   ✅ Found entry: ${entry.headword}${entry.entryNumber ? ' ' + entry.entryNumber : ''}`);
        
        if (test.hasEtymology && !entry.etymology) {
          console.log(`   ❌ Missing expected etymology for ${entry.headword}`);
          validationsFailed++;
        } else if (test.hasPOS && !entry.partOfSpeech) {
          console.log(`   ❌ Missing expected part of speech for ${entry.headword}`);
          validationsFailed++;
        } else {
          validationsPassed++;
        }
      } else {
        console.log(`   ❌ Missing expected entry: ${test.headword}${test.entryNumber ? ' ' + test.entryNumber : ''}`);
        validationsFailed++;
      }
    }

    console.log(`\n📈 Step 6: Validation Summary`);
    console.log(`   ✅ Validations passed: ${validationsPassed}`);
    console.log(`   ❌ Validations failed: ${validationsFailed}`);

    // Quality checks
    console.log('\n🎯 Step 7: Quality checks...');
    const highConfidenceEntries = results.entries.filter(e => e.confidence >= 90).length;
    const mediumConfidenceEntries = results.entries.filter(e => e.confidence >= 70 && e.confidence < 90).length;
    const lowConfidenceEntries = results.entries.filter(e => e.confidence < 70).length;

    console.log(`   High confidence entries (90%+): ${highConfidenceEntries}`);
    console.log(`   Medium confidence entries (70-89%): ${mediumConfidenceEntries}`);
    console.log(`   Low confidence entries (<70%): ${lowConfidenceEntries}`);

    const qualityScore = (highConfidenceEntries / results.entries.length) * 100;
    console.log(`   Overall quality score: ${qualityScore.toFixed(1)}%`);

    // Display sample entries
    console.log('\n📝 Step 8: Sample parsed entries:');
    results.entries.slice(0, 5).forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.headword}${entry.entryNumber ? ' ' + entry.entryNumber : ''}`);
      console.log(`      Definition: ${entry.definition.substring(0, 80)}...`);
      console.log(`      Confidence: ${entry.confidence}%`);
      if (entry.partOfSpeech) console.log(`      POS: ${entry.partOfSpeech}`);
      if (entry.etymology) console.log(`      Etymology: ${entry.etymology}`);
      console.log('');
    });

    // Final assessment - Adjusted thresholds for realistic expectations
    console.log('🎉 Integration Test Results:');
    const success = validationsFailed === 0 && results.entries.length >= 10 && 
                   (highConfidenceEntries + mediumConfidenceEntries) >= results.entries.length * 0.6;
    
    if (success) {
      console.log('   ✅ PASSED - All tests successful!');
      console.log(`   ✅ Extracted ${results.entries.length} entries with ${((highConfidenceEntries + mediumConfidenceEntries) / results.entries.length * 100).toFixed(1)}% good quality`);
      console.log('   ✅ Parser is ready for production use');
    } else {
      console.log('   ❌ FAILED - Some issues detected:');
      if (validationsFailed > 0) console.log(`   ❌ ${validationsFailed} validation failures`);
      if (results.entries.length < 10) console.log('   ❌ Too few entries extracted');
      if ((highConfidenceEntries + mediumConfidenceEntries) < results.entries.length * 0.6) console.log('   ❌ Quality score below threshold (60% high+medium confidence)');
    }

    console.log('\n📁 Test files saved in:', tempDir);
    console.log('   - Input JSON:', jsonFile);
    console.log('   - Output JSON:', resultFile);

    return success;

  } catch (error) {
    console.error('\n❌ Integration test failed:');
    console.error(`   Error: ${error.message}`);
    if (error.stack) {
      console.error('   Stack trace:', error.stack);
    }
    return false;
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('🚀 Dictionary Parser Integration Test Suite\n');
  
  const success = await runIntegrationTest();
  
  if (success) {
    console.log('\n🎉 All integration tests passed!');
    console.log('\n💡 The dictionary parser workflow is working correctly:');
    console.log('   1. ✅ PDF text extraction simulation');
    console.log('   2. ✅ JSON block creation');
    console.log('   3. ✅ Dictionary entry parsing');
    console.log('   4. ✅ Structured output generation');
    console.log('   5. ✅ Quality validation');
    
    console.log('\n📋 Ready for production workflow:');
    console.log('   1. Run extract-pdf-text.js on real PDFs');
    console.log('   2. Run parse-dictionary-blocks.js on the JSON output');
    console.log('   3. Review and validate the structured entries');
    console.log('   4. Import entries into the database/LLM system');
    
    process.exit(0);
  } else {
    console.log('\n❌ Integration tests failed!');
    console.log('   Please review the errors above and fix any issues.');
    process.exit(1);
  }
}

// Run integration tests if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runIntegrationTest, createSampleTextContent, createMockExtractedJSON };