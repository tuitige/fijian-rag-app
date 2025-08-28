# Dictionary PDF Processing Lambda

This Lambda function is dedicated to processing dictionary PDF files uploaded to S3. It was separated from the learning module processing Lambda to resolve conflicts where PDF files were incorrectly processed as JSON manifests.

## Functionality

- **S3 Triggers**: Automatically processes PDF files uploaded to `s3://bucket/dictionary/*.pdf`
- **API Gateway**: Manual processing via `POST /dictionary/process` endpoint
- **Direct Invocation**: Support for programmatic processing with `action: 'process_pdf'`

## Processing Pipeline

The Lambda uses the `FijianDictionaryProcessor` from `../dictionary/processor.ts` to:

1. Extract text from PDF using AWS Textract
2. Parse dictionary entries using intelligent parsing algorithms
3. Generate embeddings for vector search
4. Index entries to DynamoDB
5. Index entries to OpenSearch for RAG capabilities
6. Store processed outputs in S3

## Environment Variables

- `CONTENT_BUCKET_NAME`: S3 bucket for source files and outputs
- `DICTIONARY_TABLE`: DynamoDB table for dictionary entries
- `OS_ENDPOINT`: OpenSearch endpoint for vector indexing
- `OS_REGION`: AWS region for OpenSearch

## Permissions

- **DynamoDB**: Read/write access to dictionary table
- **S3**: Read access to PDFs, write access for outputs
- **OpenSearch**: Full access for indexing and search
- **Textract**: Document analysis for PDF text extraction

## File Filtering

Only processes files that:
- Have `.pdf` extension (case-insensitive)
- Are located in directories containing "dictionary"
- Are uploaded to S3 with proper event notification configuration

## Error Handling

- Returns HTTP 400 for unsupported file types or event types
- Returns HTTP 500 for processing failures with detailed error messages
- Logs all processing steps for debugging and monitoring

## Related Components

- `../dictionary/processor.ts`: Core processing logic
- `../dictionary/pdf-extractor.ts`: PDF text extraction
- `../dictionary/dictionary-parser.ts`: Entry parsing algorithms
- `../dictionary/opensearch.ts`: Vector search integration

## Monitoring

CloudWatch metrics and logs are automatically configured through the CDK stack. Dashboard widgets track:
- Processing success/failure rates
- Processing duration
- Number of entries processed per file

## Separation from Learning Modules

This Lambda was created to separate concerns from the learning module processing Lambda (`../dictionary/index.ts`), which now handles only JSON manifest files for learning content.