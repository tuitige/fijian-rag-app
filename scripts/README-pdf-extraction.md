# Local PDF Text Extraction Script

This script provides a local alternative to OCR-based text extraction for text-selectable dictionary PDFs. It serves as Step 1 in the dictionary ingestion pipeline, extracting raw text and preparing it for downstream LLM processing.

## Overview

The `extract-pdf-text.js` script uses the `pdf-parse` library to extract text from text-selectable PDFs and outputs:

1. **Raw text file (`.txt`)**: All extracted text from the PDF
2. **JSON file (`.json`)**: Text organized into blocks with metadata for LLM processing

This approach is ideal for high-quality, text-selectable PDFs and provides faster, more accurate results than OCR for such documents.

## Prerequisites

### Node.js Installation
- **Node.js 16 or higher** is required
- Check your version: `node --version`

#### Installing Node.js (for new users):

**Windows/macOS:**
1. Download from [nodejs.org](https://nodejs.org/)
2. Run the installer
3. Verify installation: `node --version`

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Linux (CentOS/RHEL):**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

**macOS (using Homebrew):**
```bash
brew install node
```

### Dependencies
The script will automatically install the required `pdf-parse` library if it's not already available. Alternatively, you can install it manually:

```bash
npm install pdf-parse
```

## Usage

### Basic Usage
```bash
node scripts/extract-pdf-text.js <input.pdf> [output-prefix]
```

### Examples

1. **Extract from a local PDF:**
   ```bash
   node scripts/extract-pdf-text.js dictionary.pdf
   ```
   Creates: `dictionary.txt` and `dictionary.json`

2. **Extract with custom output prefix:**
   ```bash
   node scripts/extract-pdf-text.js dictionary.pdf fijian-dict
   ```
   Creates: `fijian-dict.txt` and `fijian-dict.json`

3. **Extract from the test PDF:**
   ```bash
   node scripts/extract-pdf-text.js ./data-processing/docs/Fijian-English_Dictionary.pdf fijian-english
   ```

4. **Get help:**
   ```bash
   node scripts/extract-pdf-text.js --help
   ```

## Output Format

### Text File (`.txt`)
Contains all extracted text as-is from the PDF, preserving line breaks and formatting.

### JSON File (`.json`)
Structured format with metadata and text blocks:

```json
{
  "metadata": {
    "extraction_timestamp": "2024-01-01T12:00:00.000Z",
    "source_file": "dictionary.pdf",
    "extraction_method": "pdf-parse",
    "total_blocks": 150,
    "total_characters": 50000,
    "pdf_info": {
      "Title": "Fijian-English Dictionary",
      "Author": "...",
      "Creator": "...",
      "Producer": "...",
      "CreationDate": "...",
      "ModDate": "..."
    },
    "pdf_metadata": {}
  },
  "blocks": [
    {
      "block": "A\napple (n.) A fruit that grows on trees..."
    },
    {
      "block": "B\nbanana (n.) A yellow tropical fruit..."
    }
  ]
}
```

### Block Structure
Text is automatically divided into logical blocks based on:
- Section headers (single letters: A, B, C, etc.)
- Page headers and footers
- Dictionary formatting patterns
- Natural text boundaries

This block structure is optimized for downstream LLM processing to parse individual dictionary entries.

## Integration with Existing Pipeline

This script outputs data in a format compatible with the existing dictionary processing pipeline:

1. **Input**: Text-selectable PDF
2. **Output**: Raw text + JSON blocks
3. **Next Step**: LLM-based parsing (see existing `dictionary-parser.ts`)

The JSON format is designed to work with the existing `DictionaryParser` class for further processing into structured dictionary entries.

## Troubleshooting

### Common Issues

1. **"pdf-parse not found" error:**
   - The script will try to auto-install the library
   - If that fails, manually run: `npm install pdf-parse`

2. **"Input file not found" error:**
   - Check the file path is correct
   - Use absolute paths if needed: `/full/path/to/file.pdf`

3. **"Input file must be a PDF" error:**
   - Ensure the file has a `.pdf` extension
   - Verify the file is actually a PDF

4. **Memory errors with large PDFs:**
   - Increase Node.js memory limit: `node --max-old-space-size=4096 scripts/extract-pdf-text.js large-file.pdf`
   - Consider splitting very large PDFs

5. **Poor extraction quality:**
   - This script works best with text-selectable PDFs
   - For scanned/image PDFs, use the existing AWS Textract solution
   - Check if the PDF is password-protected

### Performance Notes

- **Speed**: Much faster than OCR for text-selectable PDFs
- **Accuracy**: Near 100% for properly formatted text-selectable PDFs
- **Memory**: Uses minimal memory compared to OCR solutions
- **Offline**: Works completely offline, no cloud dependencies

## Comparison with Existing Solutions

| Feature | Local Script | AWS Textract |
|---------|-------------|--------------|
| PDF Type | Text-selectable only | All PDFs (including scanned) |
| Speed | Very fast | Slower (API calls) |
| Cost | Free | AWS charges apply |
| Accuracy | Near 100% for text PDFs | Good for all PDFs |
| Dependencies | Node.js + pdf-parse | AWS account + credentials |
| Offline | Yes | No |

## Development and Testing

### Running Tests
```bash
# Test with the sample PDF
node scripts/extract-pdf-text.js ./data-processing/docs/Fijian-English_Dictionary.pdf test-output

# Verify output files were created
ls -la test-output.*
```

### Script Modules
The script exports functions for programmatic use:
```javascript
const { extractTextFromPDF, processTextIntoBlocks, saveOutputFiles } = require('./scripts/extract-pdf-text.js');
```

## Future Enhancements

Potential improvements for future versions:
- Support for multi-column layouts
- Better block detection algorithms
- Integration with existing TypeScript codebase
- Batch processing for multiple PDFs
- Progress indicators for large files
- Configuration files for custom block detection rules

## Support

For issues related to this script:
1. Check the troubleshooting section above
2. Verify your Node.js version meets requirements
3. Test with a simple, small PDF first
4. Review the console output for specific error messages

For general project questions, refer to the main repository documentation.