#!/usr/bin/env node

/**
 * Local PDF Text Extraction Script
 * 
 * Extracts text from text-selectable PDF files as an alternative to OCR approaches.
 * This script uses the pdf-parse library to extract raw text and outputs both:
 * - Raw text file (.txt)
 * - Basic JSON format with line-wise blocks for downstream LLM processing
 * 
 * Usage:
 *   node scripts/extract-pdf-text.js [input.pdf] [output-prefix]
 *   
 * Examples:
 *   node scripts/extract-pdf-text.js dictionary.pdf dictionary
 *   node scripts/extract-pdf-text.js ./data-processing/docs/Fijian-English_Dictionary.pdf fijian-dict
 * 
 * Prerequisites:
 *   - Node.js 16+ 
 *   - npm install pdf-parse (will be installed automatically if missing)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Function to ensure pdf-parse is installed
function ensurePdfParseInstalled() {
  try {
    require.resolve('pdf-parse');
    console.log('✅ pdf-parse library found');
  } catch (e) {
    console.log('📦 Installing pdf-parse library...');
    try {
      execSync('npm install pdf-parse', { stdio: 'inherit' });
      console.log('✅ pdf-parse installed successfully');
    } catch (installError) {
      console.error('❌ Failed to install pdf-parse. Please install manually:');
      console.error('   npm install pdf-parse');
      process.exit(1);
    }
  }
}

// Function to validate input file
function validateInputFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: Input file not found: ${filePath}`);
    process.exit(1);
  }
  
  if (path.extname(filePath).toLowerCase() !== '.pdf') {
    console.error(`❌ Error: Input file must be a PDF: ${filePath}`);
    process.exit(1);
  }
  
  console.log(`✅ Input PDF validated: ${filePath}`);
}

// Function to extract text from PDF
async function extractTextFromPDF(pdfPath) {
  const pdf = require('pdf-parse');
  
  console.log('📖 Reading PDF file...');
  const dataBuffer = fs.readFileSync(pdfPath);
  
  console.log('🔍 Extracting text from PDF...');
  const data = await pdf(dataBuffer);
  
  console.log(`✅ Text extraction completed:`);
  console.log(`   - Pages processed: ${data.numpages}`);
  console.log(`   - Characters extracted: ${data.text.length}`);
  
  return {
    text: data.text,
    numPages: data.numpages,
    info: data.info,
    metadata: data.metadata
  };
}

// Function to process text into blocks
function processTextIntoBlocks(text) {
  // Split text into lines and filter out empty lines
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const blocks = [];
  let currentBlock = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Simple heuristic for block boundaries:
    // - Single letters (A, B, C) often start new sections
    // - Lines that look like page headers/footers
    // - Lines with significant indentation changes
    
    const isNewSectionStart = /^[A-Z]$/.test(line) || // Single letter sections
                             /^[A-Z]\s*$/.test(line) || // Single letter with whitespace
                             /^FIJIAN\s*[–-]\s*ENGLISH/i.test(line) || // Dictionary headers
                             /^Page\s+\d+/i.test(line) || // Page numbers
                             /^\d+$/.test(line); // Standalone numbers
    
    if (isNewSectionStart && currentBlock.trim().length > 0) {
      // Save current block and start new one
      blocks.push({
        block: currentBlock.trim()
      });
      currentBlock = line;
    } else {
      // Add to current block
      if (currentBlock.length > 0) {
        currentBlock += '\n' + line;
      } else {
        currentBlock = line;
      }
    }
  }
  
  // Add the last block if it has content
  if (currentBlock.trim().length > 0) {
    blocks.push({
      block: currentBlock.trim()
    });
  }
  
  return blocks;
}

// Function to save output files
function saveOutputFiles(outputPrefix, rawText, blocks, metadata) {
  const txtFile = `${outputPrefix}.txt`;
  const jsonFile = `${outputPrefix}.json`;
  
  console.log('💾 Saving output files...');
  
  // Save raw text file
  fs.writeFileSync(txtFile, rawText, 'utf8');
  console.log(`✅ Raw text saved to: ${txtFile}`);
  
  // Prepare JSON output with metadata
  const jsonOutput = {
    metadata: {
      extraction_timestamp: new Date().toISOString(),
      source_file: path.basename(process.argv[2]),
      extraction_method: 'pdf-parse',
      total_blocks: blocks.length,
      total_characters: rawText.length,
      pdf_info: metadata.info || {},
      pdf_metadata: metadata.metadata || {}
    },
    blocks: blocks
  };
  
  // Save JSON file with pretty formatting
  fs.writeFileSync(jsonFile, JSON.stringify(jsonOutput, null, 2), 'utf8');
  console.log(`✅ JSON blocks saved to: ${jsonFile}`);
  
  return { txtFile, jsonFile };
}

// Function to display usage information
function showUsage() {
  console.log(`
📚 PDF Text Extraction Script

Usage:
  node scripts/extract-pdf-text.js <input.pdf> [output-prefix]

Arguments:
  input.pdf      Path to the PDF file to extract text from
  output-prefix  Prefix for output files (default: same as input filename)

Examples:
  node scripts/extract-pdf-text.js dictionary.pdf
  node scripts/extract-pdf-text.js ./data-processing/docs/Fijian-English_Dictionary.pdf fijian-dict
  node scripts/extract-pdf-text.js manual.pdf manual-extract

Output Files:
  <prefix>.txt   Raw text extracted from PDF
  <prefix>.json  Structured JSON with text blocks and metadata

Prerequisites:
  - Node.js 16 or higher
  - pdf-parse library (will be auto-installed if missing)

Note: This script works best with text-selectable PDFs. For scanned PDFs,
      consider using the existing OCR-based AWS Textract solution.
`);
}

// Main function
async function main() {
  console.log('🚀 PDF Text Extraction Script Starting...\n');
  
  // Check command line arguments
  if (process.argv.length < 3 || process.argv[2] === '--help' || process.argv[2] === '-h') {
    showUsage();
    process.exit(0);
  }
  
  const inputPdf = process.argv[2];
  const outputPrefix = process.argv[3] || path.parse(inputPdf).name;
  
  try {
    // Step 1: Ensure dependencies are available
    ensurePdfParseInstalled();
    
    // Step 2: Validate input file
    validateInputFile(inputPdf);
    
    // Step 3: Extract text from PDF
    const extractedData = await extractTextFromPDF(inputPdf);
    
    // Step 4: Process text into blocks
    console.log('🔄 Processing text into blocks...');
    const blocks = processTextIntoBlocks(extractedData.text);
    console.log(`✅ Text processed into ${blocks.length} blocks`);
    
    // Step 5: Save output files
    const savedFiles = saveOutputFiles(outputPrefix, extractedData.text, blocks, extractedData);
    
    // Step 6: Display summary
    console.log('\n🎉 Extraction completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Input PDF: ${inputPdf}`);
    console.log(`   - Pages processed: ${extractedData.numPages}`);
    console.log(`   - Total characters: ${extractedData.text.length}`);
    console.log(`   - Text blocks created: ${blocks.length}`);
    console.log(`   - Raw text file: ${savedFiles.txtFile}`);
    console.log(`   - JSON blocks file: ${savedFiles.jsonFile}`);
    
    // Display sample blocks
    if (blocks.length > 0) {
      console.log('\n🔍 Sample blocks:');
      blocks.slice(0, 3).forEach((block, index) => {
        const preview = block.block.substring(0, 80).replace(/\n/g, ' ');
        console.log(`   ${index + 1}. "${preview}${block.block.length > 80 ? '...' : ''}"`);
      });
    }
    
    console.log('\n💡 Next steps:');
    console.log('   - Review the extracted text for quality');
    console.log('   - Use the JSON file for downstream LLM processing');
    console.log('   - The text blocks are ready for dictionary entry parsing');
    
  } catch (error) {
    console.error('\n❌ Extraction failed:');
    console.error(`   ${error.message}`);
    console.error('\n🔧 Troubleshooting:');
    console.error('   - Ensure the PDF is text-selectable (not a scanned image)');
    console.error('   - Check that you have sufficient memory for large PDFs');
    console.error('   - Verify the PDF file is not corrupted or password-protected');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  extractTextFromPDF,
  processTextIntoBlocks,
  saveOutputFiles
};