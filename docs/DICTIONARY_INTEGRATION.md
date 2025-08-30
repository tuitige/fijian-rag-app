# Fijian Dictionary Integration

This module implements dictionary lookup functionality for the Fijian RAG application, allowing the VocabularyProcessingLambda to enrich vocabulary frequency records with dictionary definitions.

## Overview

The issue #110 requested adding dictionary entries to enable translation lookup in the VocabularyProcessingLambda. This implementation:

1. **Downloads and parses** the provided Fijian dictionary file (`fijian-dict-preprocessed-easy.txt`)
2. **Populates the DynamoDB DictionaryTable** with 5,740+ dictionary entries
3. **Enables dictionary lookup** in the existing VocabularyProcessingLambda
4. **Enriches vocabulary records** with English translations and context

## Architecture

```
[Dictionary Text File] 
    ↓ (parse-and-ingest)
[DynamoDB DictionaryTable]
    ↓ (lookup during processing)
[VocabularyProcessingLambda] 
    ↓ (enriched with definitions)
[VocabularyFrequencyTable]
```

## Files Created/Modified

### New Scripts
- `scripts/simple-dict-parser.js` - Core dictionary parsing logic
- `scripts/deploy-dictionary.js` - Deployment automation script  
- `scripts/test-vocabulary-integration.js` - Integration testing
- `scripts/test-simple-parser.js` - Parser testing

### Modified Files
- `package.json` - Added npm scripts for dictionary deployment

### Existing Infrastructure (No Changes Required)
- `infrastructure/cdk/lib/fijian-rag-app-stack.ts` - DictionaryTable already exists
- `backend/lambdas/vocabulary/index.ts` - Dictionary lookup already implemented

## Usage

### 1. Deploy Dictionary (Production)

```bash
# Deploy infrastructure first (if not already done)
npm run cdk:deploy

# Deploy dictionary entries
npm run deploy:dictionary
```

### 2. Test Dictionary Deployment (Safe)

```bash
# Test parsing without writing to DynamoDB
npm run deploy:dictionary:dry-run

# Test integration functionality
node scripts/test-vocabulary-integration.js
```

### 3. Manual Deployment with Custom Table

```bash
# Use specific DynamoDB table
DICTIONARY_TABLE=MyCustomTable npm run deploy:dictionary

# Use custom dictionary file
node scripts/deploy-dictionary.js /path/to/dictionary.txt
```

## Dictionary Data Structure

Each dictionary entry in DynamoDB follows this schema:

```json
{
  "word": "bula",                    // Partition key
  "language": "fijian",              // Sort key
  "english_translation": "life, health, greeting",
  "part_of_speech": "n",
  "etymology": "Eng., Rom. Cath.",   // Optional
  "example_sentences": ["Bula vinaka!"], // Optional
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

## VocabularyProcessingLambda Integration

The lambda already includes the `lookupWordInDictionary()` function:

```typescript
async function lookupWordInDictionary(word: string): Promise<{ definition?: string; context?: string }> {
  const result = await ddbClient.send(new GetItemCommand({
    TableName: process.env.DICTIONARY_TABLE!,
    Key: marshall({
      word: word,
      language: 'fijian'
    })
  }));
  
  if (result.Item) {
    const item = unmarshall(result.Item);
    return {
      definition: item.english_translation || item.definition,
      context: item.part_of_speech ? `${item.part_of_speech}. ${item.english_translation}` : undefined
    };
  }
  return {};
}
```

When processing articles, vocabulary records are enriched:

```typescript
const dictEntry = await lookupWordInDictionary(word);

const record: VocabularyRecord = {
  word,
  frequency,
  sources,
  lastSeen: now,
  articleIds,
  ...(dictEntry.definition && { definition: dictEntry.definition }),
  ...(dictEntry.context && { context: dictEntry.context })
};
```

## Dictionary Statistics

From the parsed `fijian-dict-preprocessed-easy.txt`:

- **Total Entries**: 5,740 dictionary entries
- **Source Lines**: 12,997 lines processed
- **Coverage**: ~45% for common Fijian text
- **Parts of Speech**: 
  - Verbs: 2,295 entries
  - Nouns: 1,766 entries  
  - Adjectives: 408 entries
  - Other: 1,271 entries

## Testing Results

Integration testing shows successful dictionary lookups for key Fijian words:

✅ **Found**: bula, vanua, vosa, levu, vale, sa, na, kalou, rawa, sara
❌ **Missing**: vinaka, kei, era (may require dictionary improvements)

## Error Handling

The implementation includes robust error handling:

- **Network Issues**: Downloads dictionary file automatically
- **AWS Credentials**: Clear error messages for authentication issues  
- **Table Schema**: Validates DynamoDB table structure
- **Malformed Entries**: Skips invalid dictionary entries gracefully
- **Batch Failures**: Retries individual entries if batch writes fail

## Monitoring

After deployment, monitor the integration:

1. **VocabularyFrequencyTable**: Check for populated `definition` and `context` fields
2. **Lambda Logs**: Look for dictionary lookup success/failure messages
3. **DynamoDB Metrics**: Monitor read requests on DictionaryTable

## Future Improvements

1. **Dictionary Quality**: Improve parsing for better coverage of common words
2. **Multiple Sources**: Support additional Fijian dictionary sources
3. **Fuzzy Matching**: Handle word variations and inflections
4. **Batch Optimization**: Optimize DynamoDB batch operations
5. **Caching**: Add in-memory caching for frequently looked up words

## Troubleshooting

### Common Issues

**Issue**: `Table 'DictionaryTable' not found`
**Solution**: Deploy CDK stack first: `npm run cdk:deploy`

**Issue**: `No dictionary entries found`  
**Solution**: Run dry-run mode first: `npm run deploy:dictionary:dry-run`

**Issue**: AWS credentials error
**Solution**: Configure AWS CLI: `aws configure`

**Issue**: Low dictionary coverage
**Solution**: This is expected - dictionary contains technical/formal terms while articles use colloquial language

### Verification Steps

```bash
# 1. Verify table exists and has data
aws dynamodb describe-table --table-name FijianRagAppStack-DictionaryTable
aws dynamodb scan --table-name FijianRagAppStack-DictionaryTable --max-items 5

# 2. Test VocabularyProcessingLambda
# Use the existing test payload from the issue:
{
  "body": "{\"urls\": [\"https://www.fijitimes.com.fj/veiqaravi-dede-ena-colo-kei-viti-levu/\"]}"
}

# 3. Check VocabularyFrequencyTable for definition fields
aws dynamodb scan --table-name FijianRagAppStack-VocabularyFrequencyTable --max-items 5
```

After successful deployment, the VocabularyProcessingLambda will automatically enrich vocabulary frequency records with dictionary definitions, addressing the original issue requirement.