#!/usr/bin/env node

/**
 * Simple validation test for the PDF extraction script
 * Tests that the extraction produces expected output format
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function runValidationTest() {
  console.log('🧪 Running PDF extraction validation test...\n');
  
  const testOutputPrefix = '/tmp/pdf-validation-test';
  const expectedTxtFile = `${testOutputPrefix}.txt`;
  const expectedJsonFile = `${testOutputPrefix}.json`;
  
  try {
    // Clean up any existing test files
    if (fs.existsSync(expectedTxtFile)) fs.unlinkSync(expectedTxtFile);
    if (fs.existsSync(expectedJsonFile)) fs.unlinkSync(expectedJsonFile);
    
    console.log('1️⃣ Testing PDF extraction script...');
    
    // Run the extraction script
    const extractionCommand = `node scripts/extract-pdf-text.js ./data-processing/docs/Fijian-English_Dictionary.pdf ${testOutputPrefix}`;
    console.log(`   Running: ${extractionCommand}`);
    
    const output = execSync(extractionCommand, { encoding: 'utf8' });
    console.log('✅ Extraction completed successfully');
    
    console.log('\n2️⃣ Validating output files...');
    
    // Check that output files exist
    if (!fs.existsSync(expectedTxtFile)) {
      throw new Error(`Expected text file not found: ${expectedTxtFile}`);
    }
    console.log('✅ Text file created');
    
    if (!fs.existsSync(expectedJsonFile)) {
      throw new Error(`Expected JSON file not found: ${expectedJsonFile}`);
    }
    console.log('✅ JSON file created');
    
    console.log('\n3️⃣ Validating file contents...');
    
    // Check text file content
    const txtContent = fs.readFileSync(expectedTxtFile, 'utf8');
    if (txtContent.length < 1000) {
      throw new Error('Text file seems too small');
    }
    console.log(`✅ Text file contains ${txtContent.length} characters`);
    
    // Check JSON file structure
    const jsonContent = JSON.parse(fs.readFileSync(expectedJsonFile, 'utf8'));
    
    // Validate JSON structure
    if (!jsonContent.metadata) {
      throw new Error('JSON missing metadata section');
    }
    console.log('✅ JSON has metadata section');
    
    if (!jsonContent.blocks || !Array.isArray(jsonContent.blocks)) {
      throw new Error('JSON missing or invalid blocks array');
    }
    console.log(`✅ JSON has ${jsonContent.blocks.length} blocks`);
    
    if (jsonContent.blocks.length < 10) {
      throw new Error('Too few blocks extracted');
    }
    console.log('✅ Sufficient blocks extracted');
    
    // Check metadata structure
    const metadata = jsonContent.metadata;
    const requiredFields = ['extraction_timestamp', 'source_file', 'extraction_method', 'total_blocks', 'total_characters'];
    
    for (const field of requiredFields) {
      if (!(field in metadata)) {
        throw new Error(`Missing required metadata field: ${field}`);
      }
    }
    console.log('✅ All required metadata fields present');
    
    // Check block structure
    const sampleBlock = jsonContent.blocks[0];
    if (!sampleBlock.block || typeof sampleBlock.block !== 'string') {
      throw new Error('Invalid block structure');
    }
    console.log('✅ Block structure is valid');
    
    console.log('\n4️⃣ Validating content quality...');
    
    // Check that we have actual dictionary-like content
    const allBlockText = jsonContent.blocks.map(b => b.block).join(' ');
    
    if (!allBlockText.includes('Fijian')) {
      console.warn('⚠️  Warning: Content may not contain expected Fijian dictionary text');
    } else {
      console.log('✅ Content contains expected dictionary text');
    }
    
    // Look for dictionary-style patterns
    const dictionaryPatterns = [
      /\bn\.\s/,     // noun marker
      /\bv\.\s/,     // verb marker  
      /\badj\.\s/,   // adjective marker
    ];
    
    let patternsFound = 0;
    for (const pattern of dictionaryPatterns) {
      if (pattern.test(allBlockText)) {
        patternsFound++;
      }
    }
    
    if (patternsFound > 0) {
      console.log(`✅ Found ${patternsFound} dictionary-style patterns`);
    } else {
      console.warn('⚠️  Warning: No typical dictionary patterns found');
    }
    
    console.log('\n🎉 All validation tests passed!');
    console.log('\n📊 Test Summary:');
    console.log(`   - Text file: ${expectedTxtFile} (${txtContent.length} chars)`);
    console.log(`   - JSON file: ${expectedJsonFile} (${jsonContent.blocks.length} blocks)`);
    console.log(`   - Extraction method: ${metadata.extraction_method}`);
    console.log(`   - Total characters: ${metadata.total_characters}`);
    
    // Clean up test files
    fs.unlinkSync(expectedTxtFile);
    fs.unlinkSync(expectedJsonFile);
    console.log('\n🧹 Test files cleaned up');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Validation test failed:');
    console.error(`   ${error.message}`);
    
    // Clean up on failure
    try {
      if (fs.existsSync(expectedTxtFile)) fs.unlinkSync(expectedTxtFile);
      if (fs.existsSync(expectedJsonFile)) fs.unlinkSync(expectedJsonFile);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    return false;
  }
}

// Run the test if called directly
if (require.main === module) {
  const success = runValidationTest();
  process.exit(success ? 0 : 1);
}

module.exports = { runValidationTest };