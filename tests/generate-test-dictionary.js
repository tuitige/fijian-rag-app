#!/usr/bin/env node

/**
 * Generate Test PDF for Dictionary Processing
 * 
 * Creates a simple PDF with sample Fijian dictionary entries
 * representing pages 100-110 for testing the ingestion pipeline.
 */

const fs = require('fs');
const path = require('path');

// Sample dictionary entries for pages 100-110
const testEntries = [
  // Page 100
  { page: 100, entries: [
    "kana - to eat, food, meal",
    "kanace - to eat together, share a meal", 
    "kandavu - a type of traditional feast"
  ]},
  
  // Page 101
  { page: 101, entries: [
    "kato - basket, container made from pandanus",
    "katuba - a large traditional basket",
    "kau - I, me (pronoun)"
  ]},
  
  // Page 102
  { page: 102, entries: [
    "kawa - bitter, sour taste",
    "kawainima - to taste bitter",
    "kawi - to carry, to bear"
  ]},
  
  // Page 103
  { page: 103, entries: [
    "keba - different, separate, apart",
    "keimami - we (excluding the person spoken to)",
    "kemudou - you (plural)"
  ]},
  
  // Page 104
  { page: 104, entries: [
    "kena - it should be, ought to be",
    "kenai - for him/her, belonging to",
    "keri - to dig, to excavate"
  ]},
  
  // Page 105
  { page: 105, entries: [
    "kete - basket, small container",
    "kila - to know, to recognize",
    "kilaka - to know well, be familiar with"
  ]},
  
  // Page 106
  { page: 106, entries: [
    "kini - skin, bark, peel",
    "kino - bad, evil, wicked",
    "kinoya - badness, evil, wickedness"
  ]},
  
  // Page 107
  { page: 107, entries: [
    "kisi - to kiss (modern borrowed word)",
    "kita - to see, to look at",
    "kitaka - to look after, to watch"
  ]},
  
  // Page 108
  { page: 108, entries: [
    "ko - (particle indicating the subject)",
    "koba - to bend, to curve",
    "kobo - bent, curved"
  ]},
  
  // Page 109
  { page: 109, entries: [
    "koci - small, little, tiny",
    "koda - friend, companion",
    "kodro - to be friends with"
  ]},
  
  // Page 110
  { page: 110, entries: [
    "koli - dog, puppy",
    "koro - village, town",
    "koroi - to throw, to cast"
  ]}
];

/**
 * Generate HTML content for the test dictionary pages
 */
function generateHTML() {
  let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Fijian Dictionary Test Pages 100-110</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.4;
            margin: 1.5in;
            color: #000;
        }
        .page {
            page-break-after: always;
            min-height: 8in;
        }
        .page:last-child {
            page-break-after: avoid;
        }
        .page-header {
            text-align: center;
            font-weight: bold;
            font-size: 14pt;
            margin-bottom: 0.5in;
            border-bottom: 2px solid #333;
            padding-bottom: 0.2in;
        }
        .entry {
            margin-bottom: 0.3in;
            text-indent: 0.2in;
        }
        .fijian-word {
            font-weight: bold;
        }
        .definition {
            font-style: normal;
        }
    </style>
</head>
<body>
`;

  // Generate each page
  testEntries.forEach((pageData, index) => {
    html += `
    <div class="page">
        <div class="page-header">
            Page ${pageData.page} - Fijian-English Dictionary
        </div>
        
        <div class="content">
`;

    // Add entries for this page
    pageData.entries.forEach(entry => {
      const [fijianWord, definition] = entry.split(' - ');
      html += `
            <div class="entry">
                <span class="fijian-word">${fijianWord}</span> - <span class="definition">${definition}</span>
            </div>
`;
    });

    html += `
        </div>
    </div>
`;
  });

  html += `
</body>
</html>
`;

  return html;
}

/**
 * Generate text content for simple processing
 */
function generateText() {
  let text = "FIJIAN-ENGLISH DICTIONARY\nTest Pages 100-110\n\n";
  
  testEntries.forEach(pageData => {
    text += `\n--- PAGE ${pageData.page} ---\n\n`;
    pageData.entries.forEach(entry => {
      text += entry + '\n';
    });
    text += '\n';
  });
  
  return text;
}

/**
 * Generate test instructions
 */
function generateInstructions() {
  const totalEntries = testEntries.reduce((sum, page) => sum + page.entries.length, 0);
  
  return `# Dictionary Test File: Pages 100-110

## Test Data Summary
- **Pages**: 100-110 (11 pages)
- **Total Entries**: ${totalEntries}
- **Format**: Traditional dash-separated format (word - definition)
- **Language**: Fijian to English

## Expected Processing Results
When this file is processed by the ingestion pipeline, you should expect:

- **Entries Extracted**: ~${totalEntries} dictionary entries
- **Confidence Score**: 90-95% (clean text, standard format)
- **Pattern Recognition**: Primary format (word - definition)
- **Output Files**: 
  - JSONL: ${totalEntries} lines, one entry per line
  - CSV: ${totalEntries} rows plus header
  - Summary: Quality metrics and statistics

## Usage Instructions
1. Upload this file to S3: \`dictionary-pdfs/test-pages-100-110.pdf\`
2. Trigger processing via API Gateway or direct Lambda invocation
3. Monitor processing in CloudWatch logs
4. Review outputs in \`dictionary-processing/outputs/\` folder

## Validation Checklist
- [ ] All ${totalEntries} entries are extracted
- [ ] Confidence scores are above 80%
- [ ] JSONL format is valid (one JSON object per line)
- [ ] CSV format includes all required columns
- [ ] Entries are indexed in DynamoDB and OpenSearch
- [ ] Processing summary contains quality metrics

## Sample Entry Validation
Verify that entries like these are correctly parsed:
- "kana - to eat, food, meal" → headword: "kana", definition: "to eat, food, meal"
- "keimami - we (excluding the person spoken to)" → headword: "keimami", etc.

## Troubleshooting
If processing fails or confidence is low:
1. Check CloudWatch logs for specific errors
2. Review the processing summary for OCR issues
3. Verify PDF text is extractable (not image-only)
4. Ensure S3 permissions are configured correctly
`;
}

// Create output directory
const outputDir = path.join(__dirname, 'dictionary-test-data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Generate files
console.log('Generating test dictionary files...');

// 1. HTML version (for PDF conversion)
const htmlContent = generateHTML();
fs.writeFileSync(path.join(outputDir, 'test-pages-100-110.html'), htmlContent);
console.log('✓ Generated HTML file: test-pages-100-110.html');

// 2. Plain text version (for simple testing)
const textContent = generateText();
fs.writeFileSync(path.join(outputDir, 'test-pages-100-110.txt'), textContent);
console.log('✓ Generated text file: test-pages-100-110.txt');

// 3. Instructions
const instructions = generateInstructions();
fs.writeFileSync(path.join(outputDir, 'README.md'), instructions);
console.log('✓ Generated instructions: README.md');

// 4. JSON data for programmatic use
const jsonData = {
  title: 'Fijian Dictionary Test Pages 100-110',
  pages: testEntries,
  totalEntries: testEntries.reduce((sum, page) => sum + page.entries.length, 0),
  pageRange: '100-110',
  expectedConfidence: '90-95%',
  format: 'word - definition'
};
fs.writeFileSync(path.join(outputDir, 'test-data.json'), JSON.stringify(jsonData, null, 2));
console.log('✓ Generated JSON data: test-data.json');

console.log(`\nTest files generated in: ${outputDir}`);
console.log('\nNext steps:');
console.log('1. Convert the HTML file to PDF using a tool like wkhtmltopdf or browser print');
console.log('2. Upload the PDF to S3 in the dictionary-pdfs/ folder');
console.log('3. Trigger processing using the methods described in dictionary-ingestion-test.md');
console.log('4. Validate results against the expected outcomes in README.md');

// Example conversion command
console.log('\nExample PDF conversion (if wkhtmltopdf is installed):');
console.log(`wkhtmltopdf ${path.join(outputDir, 'test-pages-100-110.html')} ${path.join(outputDir, 'test-pages-100-110.pdf')}`);