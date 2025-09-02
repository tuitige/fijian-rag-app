# Embedding Pipeline Documentation

## Overview

The Fijian RAG App embedding pipeline is designed to generate semantic embeddings for Fijian-English dictionary chunks with support for batch processing, parallelization, retries, and intermediate storage. This document outlines the implementation, model choices, and design rationales.

## Model Choice and Rationale

### Selected Model: Amazon Titan Embed Text v1

**Rationale:**
- **Multilingual Support**: Optimized for cross-lingual tasks, essential for Fijian-English translation pairs
- **Dimension Efficiency**: 1536-dimensional vectors provide good balance between performance and storage efficiency
- **AWS Native Integration**: Seamless integration with AWS Bedrock reduces latency and infrastructure complexity
- **Cost Effectiveness**: Competitive pricing for high-volume embedding generation
- **Proven Performance**: Established track record for semantic similarity tasks in multilingual contexts

**Alternative Models Considered:**
- OpenAI text-embedding-ada-002: Rejected due to external API dependency and higher latency
- sentence-transformers models: Rejected due to limited Fijian language support
- LaBSE (Language-agnostic BERT Sentence Embeddings): Considered but Amazon Titan provides better AWS integration

## Architecture Components

### 1. Enhanced Embedding Generation (`opensearch.ts`)

#### `createEmbedding(text: string, retries: number = 3)`
- **Purpose**: Generate single embedding with retry logic
- **Features**:
  - Exponential backoff with jitter for retries
  - Fallback to zero vector on total failure
  - Comprehensive error logging

#### `createEmbeddingsBatch(texts: string[], options)`
- **Purpose**: Batch embedding generation with parallelization
- **Features**:
  - Configurable batch size (default: 25)
  - Controlled concurrency (default: 5 parallel requests)
  - Progress tracking callback support
  - Rate limiting between batches

### 2. Intermediate Storage (`opensearch.ts`)

#### `storeEmbeddingsToS3(embeddings: EmbeddingMetadata[], prefix)`
- **Purpose**: Store embeddings and metadata to S3 for reuse and auditing
- **Storage Format**: JSON with comprehensive metadata
- **Benefits**:
  - Prevents re-computation of existing embeddings
  - Enables batch analysis and quality assessment
  - Provides audit trail for embedding generation

#### `EmbeddingMetadata` Interface
```typescript
interface EmbeddingMetadata {
  id: string;                // Unique identifier
  text: string;              // Original text
  embedding: number[];       // Generated embedding vector
  model: string;             // Model identifier
  dimensions: number;        // Vector dimensions
  timestamp: string;         // Generation timestamp
  success: boolean;          // Success status
  retries?: number;          // Retry attempts
  processingTime?: number;   // Processing duration
  error?: string;           // Error message if failed
  source?: string;          // Data source identifier
  category?: string;        // Content category
}
```

### 3. Enhanced Dictionary Processor (`processor.ts`)

#### `generateEmbeddings(entries, options)`
- **Purpose**: Main embedding generation orchestrator
- **Modes**:
  - **Batch Mode** (default): Efficient parallel processing for large datasets
  - **Sequential Mode**: Fallback for small datasets or debugging

#### Processing Options
```typescript
interface EmbeddingOptions {
  useBatchMode?: boolean;      // Enable batch processing (default: true)
  batchSize?: number;          // Items per batch (default: 25)
  maxConcurrency?: number;     // Parallel requests (default: 5)
  retries?: number;           // Retry attempts (default: 3)
  storeToS3?: boolean;        // Store to S3 (default: true)
  onProgress?: (completed: number, total: number) => void;
}
```

## Performance Characteristics

### Scalability
- **Batch Size**: Optimized for 25 items per batch to balance memory usage and API limits
- **Concurrency**: Limited to 5 parallel requests to respect AWS Bedrock rate limits
- **Rate Limiting**: 100ms delay between batches prevents throttling

### Error Handling
- **Retry Logic**: Exponential backoff with jitter (max 10 seconds)
- **Fallback Strategy**: Zero vectors for failed embeddings to maintain data integrity
- **Progress Tracking**: Real-time progress reporting for long-running operations

### Storage Efficiency
- **S3 Storage**: JSON format with compression-friendly structure
- **Metadata Tracking**: Comprehensive metadata for quality assessment
- **Deduplication**: Future enhancement opportunity for cache-based deduplication

## Usage Examples

### Basic Usage
```typescript
const processor = new FijianDictionaryProcessor('dictionary-table');
const entries = await processor.structureEntries(rawEntries);

// Generate embeddings with default settings
const entriesWithEmbeddings = await processor.generateEmbeddings(entries);
```

### Advanced Configuration
```typescript
// High-performance batch processing
const entriesWithEmbeddings = await processor.generateEmbeddings(entries, {
  useBatchMode: true,
  batchSize: 50,
  maxConcurrency: 10,
  retries: 5,
  storeToS3: true,
  onProgress: (completed, total) => {
    console.log(`Progress: ${completed}/${total} (${Math.round(completed/total*100)}%)`);
  }
});
```

### Sequential Processing (for debugging)
```typescript
// Sequential processing for detailed error analysis
const entriesWithEmbeddings = await processor.generateEmbeddings(entries, {
  useBatchMode: false,
  retries: 1
});
```

## Monitoring and Quality Assessment

### Success Metrics
- **Embedding Success Rate**: Percentage of successfully generated embeddings
- **Processing Time**: Total and per-item processing duration
- **Retry Rate**: Frequency of retry attempts

### Quality Indicators
- **Zero Vector Detection**: Identification of failed embedding generations
- **Consistency Checks**: Validation of embedding dimensions and format
- **Metadata Completeness**: Verification of comprehensive metadata storage

## Integration Points

### DynamoDB Storage
- Embeddings stored alongside dictionary entries
- Metadata fields added for tracking embedding status
- Compatible with existing indexing pipeline

### OpenSearch Integration
- Direct integration with existing OpenSearch indexing
- Support for vector similarity search
- Hybrid search capabilities (text + semantic)

### S3 Storage
- Intermediate storage for embeddings and metadata
- Organized by timestamp and batch ID
- Supports future batch analysis and reprocessing

## Future Enhancements

### Planned Improvements
1. **Embedding Cache**: Deduplication based on text content hashes
2. **Quality Scoring**: Automatic quality assessment of generated embeddings
3. **Model Versioning**: Support for multiple embedding models and versions
4. **Incremental Processing**: Delta processing for updated dictionary entries
5. **Performance Optimization**: Dynamic batch sizing based on API performance

### Monitoring Enhancements
1. **CloudWatch Metrics**: Real-time performance and error rate monitoring
2. **Cost Tracking**: AWS cost attribution for embedding generation
3. **Quality Dashboards**: Visual monitoring of embedding quality metrics

## Configuration

### Environment Variables
- `CONTENT_BUCKET_NAME`: S3 bucket for intermediate storage
- `OS_ENDPOINT`: OpenSearch endpoint for vector indexing
- `OS_REGION`: AWS region for OpenSearch service

### Default Settings
- **Embedding Model**: amazon.titan-embed-text-v1
- **Vector Dimensions**: 1536
- **Batch Size**: 25 items
- **Max Concurrency**: 5 parallel requests
- **Retry Attempts**: 3 with exponential backoff
- **S3 Storage**: Enabled by default

## Testing

### Unit Tests
- Individual function testing with mocked AWS services
- Error scenario validation
- Performance benchmarking

### Integration Tests
- End-to-end pipeline testing with sample data
- S3 storage validation
- OpenSearch indexing verification

### Performance Tests
- Large dataset processing validation
- Concurrency limits testing
- Memory usage monitoring

This embedding pipeline provides a robust, scalable foundation for the Fijian RAG application's semantic search capabilities while maintaining high performance and reliability standards.