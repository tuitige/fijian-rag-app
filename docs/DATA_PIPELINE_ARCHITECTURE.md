# Fijian RAG App - Data Pipeline Architecture

## Overview

The Fijian RAG App data pipeline uses a **Medallion Architecture** to manage Fijian language data ingestion, transformation, and delivery. This architecture ensures data quality, lineage, and standardization across all processing stages.

## Medallion Architecture Layers

### High-Level Flow
```
Source Data → Bronze (Raw) → Silver (Standardized) → Gold (Application) → Platinum (Analytics)
```

### Layer Descriptions

#### 🟫 Bronze Layer - Raw Data Storage
**Purpose**: Preserve raw, unprocessed data exactly as received from sources

**Storage Location**: `s3://fijian-data-lake/bronze/`

**Data Sources**:
- PDF dictionary extractions
- Manual uploads from language experts
- Scraped Fijian language content
- API imports from partner systems
- Audio transcriptions

**Folder Structure**:
```
bronze/
├── dictionaries/
│   ├── pdf/source=<source_name>/load_dt=<YYYY-MM-DD>/run_id=<uuid>/
│   │   ├── raw_files/           # Original PDF files
│   │   ├── extracted_text/      # Raw text extractions
│   │   └── metadata.json        # Ingestion metadata
│   └── manual/load_dt=<YYYY-MM-DD>/
│       └── entries.json         # Manually uploaded entries
├── articles/
│   └── source=<website>/load_dt=<YYYY-MM-DD>/
│       └── content.json         # Scraped article content
└── audio/
    └── source=<collection>/load_dt=<YYYY-MM-DD>/
        └── recordings/          # Audio files with metadata
```

**Metadata Fields** (stored in sidecar JSON):
- `source`: Data source identifier
- `ingestion_ts`: ISO 8601 timestamp
- `file_hash`: SHA256 hash for deduplication
- `record_count`: Number of records in batch
- `run_id`: Unique UUID for this ingestion
- `schema_version`: Source schema version
- `file_size_bytes`: Size of original file

**Retention Policy**: 
- Archive to S3 Glacier Deep Archive after 12 months
- Maintain audit trail for data lineage

---

#### ⚪ Silver Layer - Standardized Data
**Purpose**: Clean, deduplicated, and standardized data in efficient format

**Storage Location**: `s3://fijian-data-lake/silver/`

**Data Format**: Apache Parquet (columnar, compressed)

**Folder Structure**:
```
silver/
├── dictionary_entries/
│   └── year=<YYYY>/month=<MM>/
│       └── part-<uuid>.parquet  # Partitioned Parquet files
├── article_content/
│   └── year=<YYYY>/month=<MM>/
│       └── part-<uuid>.parquet
└── vocabulary_corpus/
    └── year=<YYYY>/month=<MM>/
        └── part-<uuid>.parquet
```

**Schema Contract**: See `schemas/contracts/dictionary-entry.yaml`

**Transformations** (Bronze → Silver):
1. **Unicode Normalization**: NFC normalization for all Fijian text
2. **Deduplication**: Remove duplicates based on natural keys
3. **Type Casting**: Enforce data types per schema contract
4. **Field Standardization**: Convert to snake_case, trim whitespace
5. **Quality Validation**: Apply data quality checks
6. **Partition Assignment**: Assign year/month partitions

**Quality Checks**:
- ✅ Required fields present and non-null
- ✅ Data types match schema contract
- ✅ No duplicate entries (warn and deduplicate)
- ✅ Valid enum values for categorical fields
- ⚠️ Pronunciation format validation (warning only)

**Retention Policy**: Retain indefinitely (serves as system of record)

---

#### 🟡 Gold Layer - Application-Ready Data
**Purpose**: Production data optimized for application access

**Storage Systems**:
- **DynamoDB Tables**: Transactional access patterns
- **OpenSearch Indices**: Full-text and semantic search
- **S3 (optional)**: Backup snapshots in Parquet

**DynamoDB Tables**:
```
DictionaryTable
├── PK: word (fijian_word)
├── SK: language (constant: "fijian")
└── Attributes: english, pronunciation, examples, verified, etc.

UserProgressTable
├── PK: userId
├── SK: timestamp
└── Attributes: moduleId, score, completedAt, etc.

LearningModulesTable
├── PK: moduleId
├── SK: contentType
└── Attributes: content, metadata, difficulty, etc.
```

**OpenSearch Indices**:
```
fijian-dictionary
├── Fields: fijian, english, pronunciation, pos, examples
├── Embedding: 1536-dimensional vector (Amazon Titan)
└── Search: Hybrid (keyword + semantic)

fijian-articles
├── Fields: title, content, source, published_date
├── Embedding: Content embeddings
└── Search: Full-text with semantic boosting
```

**Transformations** (Silver → Gold):
1. **Schema Mapping**: Transform to application schema
2. **Embedding Generation**: Create semantic embeddings via Amazon Titan
3. **Referential Integrity**: Validate foreign key relationships
4. **Metadata Enrichment**: Add frequency ranks, difficulty levels
5. **Index Optimization**: Prepare for efficient querying

**Data Loading**:
- DynamoDB: Batch writes with `PutItem` operations
- OpenSearch: Bulk indexing API with embeddings
- Validation before production merge

**Retention Policy**: Live production data with daily backups

---

#### 💎 Platinum Layer - Analytics & Aggregations (Optional)
**Purpose**: Pre-computed aggregations and optimized analytics tables

**Storage Location**: `s3://fijian-data-lake/platinum/`

**Use Cases**:
- Learning progress analytics
- Vocabulary usage patterns
- Dictionary coverage metrics
- User engagement dashboards
- A/B test results

**Tables/Views**:
```
fact_learning_sessions
├── Fact table: Learning session metrics
└── Aggregated by: user, module, date

dim_vocabulary_difficulty
├── Dimension table: Vocabulary metadata
└── Grouped by: difficulty level, part of speech

agg_daily_user_progress
├── Aggregation: Daily user progress metrics
└── Partitioned by: date, user cohort

agg_dictionary_coverage
├── Aggregation: Dictionary completeness by category
└── Updated: Weekly
```

**Retention Policy**: Retain 24 months of aggregated data

---

## Data Processing Jobs

### ETL Job Architecture

All ETL jobs are implemented as AWS Lambda functions orchestrated by AWS Step Functions.

#### Bronze → Silver ETL
**Function**: `BronzeToSilverProcessor`
**Trigger**: S3 event notification when new Bronze data arrives
**Processing**:
1. Load raw data from Bronze S3 path
2. Parse and validate against Bronze schema
3. Apply transformations (normalize, deduplicate, typecast)
4. Validate against Silver schema contract
5. Write Parquet files to Silver layer (partitioned by year/month)
6. Update data catalog (AWS Glue Data Catalog)
7. Log metrics (record counts, processing time, errors)

**Error Handling**:
- Malformed records written to dead-letter queue
- Failed batches retry with exponential backoff (3 attempts)
- Quality check failures logged but don't halt processing

#### Silver → Gold ETL
**Function**: `SilverToGoldProcessor`
**Trigger**: Manual or scheduled (monthly cadence)
**Processing**:
1. Query Silver layer Parquet files (incremental by partition)
2. Generate embeddings for new entries (batch mode)
3. Transform to application schema (DynamoDB + OpenSearch)
4. Write to staging tables/indices
5. Run data quality checks and referential integrity tests
6. Promote staging → production (atomic swap)
7. Update metadata and lineage records

**Embedding Generation**:
- Model: Amazon Titan Embed Text v1 (1536 dimensions)
- Batch size: 25 entries per batch
- Concurrency: 5 parallel requests
- Retry logic: 3 attempts with exponential backoff
- Caching: Store embeddings in S3 for reuse

#### Gold → Platinum ETL
**Function**: `GoldToPlatinumAggregator`
**Trigger**: Scheduled (weekly)
**Processing**:
1. Query Gold layer data (DynamoDB/OpenSearch)
2. Compute aggregations (SQL via Athena or Python)
3. Write results to Platinum Parquet files
4. Update dashboard data sources

---

## Orchestration

### AWS Step Functions Workflow

**Monthly ETL Workflow**:
```
Start
  ↓
[Validate Bronze Data]
  ↓
[Run Bronze→Silver ETL]
  ↓
[Run Silver→Gold ETL]
  ↓
[Generate Embeddings]
  ↓
[Data Quality Report]
  ↓
[Update Gold Indices]
  ↓
[Optional: Platinum Refresh]
  ↓
[Send Success Notification]
  ↓
End
```

**Trigger Modes**:
- **Scheduled**: Monthly cron (1st of each month at 2 AM UTC)
- **Event-Driven**: S3 PUT events in Bronze layer
- **Manual**: On-demand via AWS Console or CLI

**Monitoring**:
- CloudWatch Dashboards: Real-time pipeline metrics
- SNS Alerts: Failures, quality check warnings, SLA breaches
- X-Ray Tracing: End-to-end request tracing

---

## Data Contracts & Schema Registry

### Schema Management

**Storage**: YAML files in `schemas/contracts/` directory

**Validation Tool**: Custom Python/TypeScript validator
- Validates Silver data against schema contracts
- Enforces type constraints and nullability rules
- Checks enum values and format patterns

**Schema Evolution**:
- **Strategy**: Additive only (backward compatible)
- **Allowed**: Add new optional fields, extend enums
- **Prohibited**: Remove fields, change types, make fields required

**Version Control**:
- Schema files versioned in Git
- Schema version embedded in metadata
- Breaking changes require new major version

---

## Data Quality Framework

### Quality Dimensions

1. **Completeness**: Required fields must be populated
2. **Accuracy**: Data matches expected patterns and formats
3. **Consistency**: Values consistent across related records
4. **Uniqueness**: No duplicate entries (where applicable)
5. **Timeliness**: Data processed within SLA timeframes
6. **Validity**: Values conform to domain constraints

### Quality Checks by Layer

**Bronze**:
- ✅ File completeness (checksum validation)
- ✅ Record count matches manifest
- ✅ Source metadata present

**Silver**:
- ✅ Schema conformity (all required fields)
- ✅ Type validation (correct data types)
- ✅ Null rate within acceptable threshold (<5%)
- ✅ Duplicate detection and deduplication
- ✅ Format validation (dates, enums, etc.)

**Gold**:
- ✅ Referential integrity (foreign keys valid)
- ✅ Unique key constraints
- ✅ Embedding vector dimensions correct (1536)
- ✅ Index completeness (all records indexed)

### Quality Metrics Dashboard

**Key Metrics**:
- Record counts by layer and partition
- Schema drift alerts (unexpected fields)
- Null rate by field
- Duplicate rate
- Processing latency (end-to-end)
- Error rate by job type
- Data freshness (time since last update)

---

## Security & Compliance

### Encryption

- **At Rest**: S3 buckets use SSE-S3 encryption
- **In Transit**: TLS 1.2+ for all data transfers
- **KMS**: Optional AWS KMS encryption for sensitive data

### Access Control

**IAM Role Separation**:
- `DataIngestRole`: Write access to Bronze only
- `DataTransformRole`: Read Bronze, write Silver/Gold
- `DataAnalystRole`: Read-only access to Silver/Gold/Platinum
- `ApplicationRole`: Read-only access to Gold (DynamoDB/OpenSearch)

**S3 Bucket Policies**:
- Block all public access
- Enforce encryption in transit
- VPC endpoint access only (no internet gateway)

### Audit Trail

- **CloudTrail**: Log all S3 API calls, DynamoDB operations
- **Metadata Tracking**: Full data lineage from Bronze → Gold
- **Change Log**: Track all schema changes and ETL run results

### Data Privacy

- **PII Handling**: Fijian language data is educational (no PII expected)
- **User Data**: User progress data isolated with row-level security
- **Data Minimization**: Only store necessary fields

---

## Cost Optimization

### Storage Optimization

- **Parquet Format**: Columnar compression (5-10x space savings)
- **Partitioning**: Enable partition pruning for queries
- **Lifecycle Policies**: 
  - Bronze → Glacier after 12 months
  - Archive old Silver partitions (>24 months) to Infrequent Access
- **Small File Compaction**: Merge small Parquet files (target: 128-512 MB)

### Compute Optimization

- **Lambda Sizing**: Right-size memory (512 MB - 3 GB based on workload)
- **Batch Processing**: Process in bulk to reduce invocations
- **Embedding Caching**: Reuse embeddings from S3 cache
- **Query Optimization**: Use Athena with partition filters

### Cost Monitoring

- **Cost Allocation Tags**: Tag all resources by layer and job type
- **Budget Alerts**: Set monthly budget thresholds
- **Cost Dashboard**: Track costs by service and workload

---

## Observability

### Monitoring Stack

- **CloudWatch Logs**: All Lambda function logs
- **CloudWatch Metrics**: Custom metrics (record counts, latency, errors)
- **CloudWatch Dashboards**: Real-time pipeline health
- **X-Ray**: Distributed tracing for ETL workflows
- **SNS Alerts**: Notifications for failures and SLA breaches

### Key Alerts

1. **Critical**:
   - ETL job failure after retries
   - Data quality check failure (error severity)
   - S3 bucket access denied
   - DynamoDB/OpenSearch unavailable

2. **Warning**:
   - High null rate in Silver data (>10%)
   - Schema drift detected
   - Processing time exceeds SLA (>1 hour)
   - Duplicate record rate high (>5%)

3. **Info**:
   - ETL job completed successfully
   - New Bronze data ingested
   - Monthly pipeline run started

---

## Implementation Roadmap

### Phase 1: Foundation (Current)
- ✅ Bronze S3 bucket structure
- ✅ Silver schema contracts
- ✅ Basic data quality checks
- ⬜ Bronze→Silver ETL Lambda

### Phase 2: Core Pipeline
- ⬜ Silver→Gold ETL Lambda
- ⬜ Embedding generation pipeline
- ⬜ Step Functions orchestration
- ⬜ CloudWatch dashboards

### Phase 3: Advanced Features
- ⬜ Platinum analytics layer
- ⬜ Incremental processing
- ⬜ Schema evolution tooling
- ⬜ Self-service data catalog

### Phase 4: Optimization
- ⬜ Performance tuning
- ⬜ Cost optimization review
- ⬜ Enhanced monitoring
- ⬜ Automated quality remediation

---

## References

- [Schema Contract: Dictionary Entry](../schemas/contracts/dictionary-entry.yaml)
- [Embedding Pipeline Documentation](../EMBEDDING_PIPELINE_DOCUMENTATION.md)
- [Infrastructure CDK Stack](../infrastructure/cdk/lib/fijian-rag-app-stack.ts)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Medallion Architecture (Databricks)](https://www.databricks.com/glossary/medallion-architecture)

---

## Contact & Support

For questions about the data pipeline architecture:
- Repository: [tuitige/fijian-rag-app](https://github.com/tuitige/fijian-rag-app)
- Issues: Create a GitHub issue with label `data-pipeline`
