# Medallion Architecture Data Pipeline

This directory contains the implementation of the Medallion Architecture data pipeline for the Fijian RAG App.

## Overview

The pipeline follows the Medallion Architecture pattern with four layers:

- **Bronze**: Raw ingested data (S3)
- **Silver**: Standardized, cleaned data in Parquet format (S3)
- **Gold**: Production-ready data (DynamoDB + OpenSearch)
- **Platinum**: Aggregated analytics data (S3)

## Quick Start

### 1. Deploy Infrastructure

Deploy the CDK stack to create the S3 buckets and ETL lambdas:

```bash
cd infrastructure/cdk
npx cdk deploy --outputs-file ../../cdk-outputs.json
```

### 2. Ingest Sample Data

Use the sample data ingestion script to load test data into the Bronze layer:

```bash
# Get the Bronze bucket name from outputs
BRONZE_BUCKET=$(cat cdk-outputs.json | jq -r '.FijianRagAppStack.BronzeBucketName')

# Run the ingestion script
node scripts/ingest-sample-data.js --bronze-bucket $BRONZE_BUCKET
```

This will:
1. Upload sample Fijian dictionary entries to the Bronze layer
2. Automatically trigger the Bronze→Silver ETL via S3 event notification
3. Transform and clean the data into the Silver layer

### 3. Run Silver to Gold ETL

The Silver→Gold ETL can be triggered manually or scheduled:

```bash
# Manually invoke the Lambda
aws lambda invoke \
  --function-name FijianRagAppStack-SilverToGoldEtlLambda \
  --payload '{}' \
  response.json
```

This will:
1. Load data from Silver layer
2. Generate embeddings (placeholder in current implementation)
3. Write to DynamoDB (Gold layer)

## Architecture Components

### S3 Buckets

- **BronzeDataBucket**: Raw data with lifecycle policy (archive to Glacier after 12 months)
- **SilverDataBucket**: Parquet files partitioned by year/month
- **GoldDataBucket**: Backups of production data
- **PlatinumDataBucket**: Analytics aggregations (24-month retention)

### ETL Lambda Functions

#### Bronze→Silver ETL
- **Function**: `BronzeToSilverEtlLambda`
- **Trigger**: S3 event when new JSON files arrive in Bronze
- **Processing**:
  - Parse and validate raw data
  - Apply transformations (normalize, deduplicate, typecast)
  - Validate against schema contract
  - Write Parquet to Silver with partitioning
  - Log metrics and data quality checks

#### Silver→Gold ETL
- **Function**: `SilverToGoldEtlLambda`
- **Trigger**: Scheduled (EventBridge) or manual
- **Processing**:
  - Load Silver Parquet data (incremental by partition)
  - Generate embeddings using Amazon Titan
  - Transform to application schema
  - Write to DynamoDB
  - Index in OpenSearch (optional)

### Data Quality Framework

The `backend/shared/data-quality/validator.ts` module provides:

- Schema validation against contracts
- Data quality checks (completeness, accuracy, consistency)
- Metrics calculation (null rates, duplicate rates)
- Quality report generation

## Schema Contracts

Schema contracts are defined in `schemas/contracts/dictionary-entry.yaml` and specify:

- Bronze layer: Flexible raw data fields
- Silver layer: Standardized schema with type constraints
- Gold layer: Application schema mapping
- Data quality rules and transformation logic
- Retention policies per layer

## Data Flow

```
1. Raw Data → Bronze S3
   - Manual upload or API ingestion
   - Metadata captured (source, hash, record count)

2. Bronze → Silver ETL (triggered by S3 event)
   - Parse and validate
   - Apply transformations
   - Deduplicate
   - Write partitioned Parquet

3. Silver → Gold ETL (scheduled monthly)
   - Load Silver data
   - Generate embeddings
   - Write to DynamoDB
   - Index in OpenSearch

4. Gold → Platinum (optional, scheduled weekly)
   - Compute aggregations
   - Generate analytics tables
```

## Monitoring

### CloudWatch Dashboards

A dashboard is automatically created with widgets for:
- ETL job execution status
- Record counts per layer
- Processing time metrics
- Error rates

### Alarms (Production)

When deployed in production mode, alarms are created for:
- ETL job failures
- High error rates
- Processing time SLA breaches
- Data quality check failures

## Data Quality Checks

The pipeline implements quality checks at each layer:

### Bronze Layer
- File completeness (checksum validation)
- Record count matches manifest
- Source metadata present

### Silver Layer
- Schema conformity (all required fields)
- Type validation
- Null rate within threshold (<5%)
- Duplicate detection
- Format validation

### Gold Layer
- Referential integrity
- Unique key constraints
- Embedding vector dimensions
- Index completeness

## Cost Optimization

The pipeline includes several cost optimization strategies:

1. **Storage**:
   - Bronze data archived to Glacier after 12 months
   - Silver data transitioned to IA after 24 months
   - Platinum data expired after 24 months

2. **Compute**:
   - Batch processing to reduce Lambda invocations
   - Incremental processing (partitioned by year/month)
   - Embedding caching to avoid recomputation

3. **Queries**:
   - Partition pruning in Athena queries
   - Parquet columnar compression (5-10x space savings)

## Security

### Encryption
- All S3 buckets use SSE-S3 encryption
- DynamoDB tables use AWS-managed encryption

### IAM Roles
- Separate roles for ingestion, transformation, and read-only access
- Least privilege principle applied

### Audit Trail
- CloudTrail logs all S3 API calls
- Full data lineage tracked (Bronze → Gold)
- Metadata includes run_id, timestamps, file hashes

## Development

### Adding New Data Sources

1. Create an ingestion script following the pattern in `scripts/ingest-sample-data.js`
2. Upload data to Bronze with proper metadata
3. The Bronze→Silver ETL will automatically process it

### Modifying Schema

1. Update the schema contract in `schemas/contracts/dictionary-entry.yaml`
2. Follow additive-only evolution (backward compatible)
3. Update transformation logic in ETL lambdas if needed

### Testing ETL Jobs

```bash
# Test Bronze→Silver transformation logic
npm test -- backend/lambdas/etl-bronze-to-silver

# Test data quality checks
npm test -- backend/shared/data-quality
```

## Troubleshooting

### ETL Job Failures

Check CloudWatch Logs:
```bash
aws logs tail /aws/lambda/FijianRagAppStack-BronzeToSilverEtlLambda --follow
```

### Data Quality Issues

Review the quality metrics stored in Silver:
```bash
aws s3 ls s3://<SILVER_BUCKET>/_metrics/bronze-to-silver/
aws s3 cp s3://<SILVER_BUCKET>/_metrics/bronze-to-silver/<timestamp>.json -
```

### Missing Data

Verify data flow through layers:
```bash
# Check Bronze
aws s3 ls s3://<BRONZE_BUCKET>/dictionaries/ --recursive

# Check Silver
aws s3 ls s3://<SILVER_BUCKET>/dictionary_entries/ --recursive

# Check Gold (DynamoDB)
aws dynamodb scan --table-name <DICTIONARY_TABLE> --limit 5
```

## References

- [Data Pipeline Architecture](../docs/DATA_PIPELINE_ARCHITECTURE.md) - Comprehensive documentation
- [Schema Contract](../schemas/contracts/dictionary-entry.yaml) - Dictionary entry schema
- [Embedding Pipeline](../EMBEDDING_PIPELINE_DOCUMENTATION.md) - Embedding generation details

## Future Enhancements

### Phase 2
- [ ] Implement real Amazon Titan embedding generation
- [ ] Add OpenSearch indexing to Silver→Gold ETL
- [ ] Create Step Functions orchestration workflow
- [ ] Add EventBridge scheduled triggers

### Phase 3
- [ ] Implement Platinum layer aggregations
- [ ] Add schema drift detection
- [ ] Create self-service data catalog
- [ ] Add automated quality remediation

### Phase 4
- [ ] Performance tuning and optimization
- [ ] Enhanced monitoring and alerting
- [ ] Cost optimization review
- [ ] Data governance tooling
