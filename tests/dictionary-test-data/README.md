# Dictionary Test File: Pages 100-110

## Test Data Summary
- **Pages**: 100-110 (11 pages)
- **Total Entries**: 33
- **Format**: Traditional dash-separated format (word - definition)
- **Language**: Fijian to English

## Expected Processing Results
When this file is processed by the ingestion pipeline, you should expect:

- **Entries Extracted**: ~33 dictionary entries
- **Confidence Score**: 90-95% (clean text, standard format)
- **Pattern Recognition**: Primary format (word - definition)
- **Output Files**: 
  - JSONL: 33 lines, one entry per line
  - CSV: 33 rows plus header
  - Summary: Quality metrics and statistics

## Usage Instructions
1. Upload this file to S3: `dictionary-pdfs/test-pages-100-110.pdf`
2. Trigger processing via API Gateway or direct Lambda invocation
3. Monitor processing in CloudWatch logs
4. Review outputs in `dictionary-processing/outputs/` folder

## Validation Checklist
- [ ] All 33 entries are extracted
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
