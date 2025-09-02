# RAG Integration in Chat Pipeline Documentation

## Overview

This document describes the implementation of Retrieval-Augmented Generation (RAG) integration into the Fijian chat pipeline. The integration enables dictionary retrieval and context injection into LLM conversations, supporting both fuzzy (vector/semantic) and exact (DynamoDB) lookups as specified in issue #90.

## Architecture

### Before Integration
```
User Input → Chat Handler → Claude (Direct) → Response
```

### After Integration
```
User Input → Chat Handler → Dictionary Retrieval → Context Augmentation → Claude → Enhanced Response
                         ↓
                    [Exact Lookup + Semantic Search]
                         ↓
                    [DynamoDB + OpenSearch]
```

## Implementation Details

### 1. Core Components

#### RAG Service Module
- **Location**: `backend/lambdas/chat/src/rag-service.ts` and `backend/lambdas/rag/src/rag-service.ts`
- **Purpose**: Provides reusable RAG functionality for dictionary retrieval and context formatting
- **Key Functions**:
  - `retrieveRagContext()`: Orchestrates dictionary lookup and semantic search
  - `lookupWordExact()`: Performs exact word lookup in DynamoDB
  - `searchDictionarySemantic()`: Performs vector/semantic search in OpenSearch
  - `formatDictionaryContext()`: Formats dictionary entries for LLM prompts
  - `createRagSystemPrompt()`: Creates mode-specific system prompts with RAG awareness

#### Dictionary Retrieval Strategy
1. **Exact Lookup**: Extracts potential Fijian words from user input and looks them up directly in DynamoDB
2. **Semantic Search**: Creates embeddings for the user query and performs hybrid search in OpenSearch
3. **Deduplication**: Merges results while avoiding duplicate entries
4. **Ranking**: Applies score thresholds and limits to most relevant entries

### 2. API Integration

#### Chat Endpoint Enhancements (`POST /chat`)
- **New Parameter**: `enableRag` (boolean, default: true)
- **Backward Compatibility**: Existing requests work unchanged
- **Response Additions**:
  - `ragEnabled`: Whether RAG was used for this request
  - `ragContext`: Metadata about retrieved dictionary entries
    - `entriesUsed`: Number of dictionary entries found
    - `sources`: Array of source information with word, score, and type

#### Streaming Chat Endpoint (`POST /chat/stream`)
- **Same enhancements** as regular chat endpoint
- **Maintains streaming compatibility** for future implementation

#### Example Request
```json
{
  "input": "What does bula mean?",
  "mode": "learning",
  "enableRag": true,
  "userId": "user123"
}
```

#### Example Response
```json
{
  "message": "Bula is a common Fijian greeting that means 'hello' or 'life'. It's used throughout the day...",
  "mode": "learning",
  "ragEnabled": true,
  "ragContext": {
    "entriesUsed": 2,
    "sources": [
      { "word": "bula", "type": "exact" },
      { "word": "greeting", "score": 0.85, "type": "semantic" }
    ]
  }
}
```

### 3. Context Augmentation Process

#### Word Extraction
- Extracts potential Fijian words from user input using regex patterns
- Filters words by length (2-20 characters) and alphabetic content
- Limits to first 3 words to prevent over-lookup

#### Context Formatting
Dictionary entries are formatted as:
```
Fijian: bula (n.)
English: hello, greeting, life
Notes: Traditional greeting used throughout the day, expressing good wishes
```

#### Prompt Augmentation
User prompts are enhanced with relevant dictionary context:
```
Relevant Dictionary Context:
[Dictionary entries formatted as above]

User Question: What does bula mean?
```

### 4. Configuration Options

#### RagContextOptions Interface
```typescript
interface RagContextOptions {
  maxEntries?: number;      // Default: 3 for chat, 5 for RAG endpoint
  minScore?: number;        // Default: 0.2 for chat, 0.1 for RAG endpoint  
  includeExactLookup?: boolean;    // Default: true
  includeSemanticSearch?: boolean; // Default: true
}
```

#### Mode-Specific Behavior
- **Translation Mode**: Emphasizes accuracy and cultural nuances
- **Learning Mode**: Provides detailed explanations and usage examples
- **Conversation Mode**: Offers natural language guidance and context

## Performance Considerations

### 1. Retrieval Limits
- **Chat endpoints**: Limited to 3 dictionary entries to maintain response speed
- **RAG endpoint**: Limited to 5 dictionary entries for comprehensive coverage
- **Score thresholds**: Higher for chat (0.2) to ensure relevance

### 2. Fallback Behavior
- **RAG failures**: Gracefully fall back to original system prompts
- **No context found**: Continue with normal LLM operation
- **Network issues**: Degrade gracefully without breaking chat functionality

### 3. Caching Strategy
- **Future enhancement**: In-memory caching for frequently looked up words
- **Current**: Direct database/OpenSearch queries with AWS service optimization

## Testing

### Manual Testing Script
Use `test-rag-integration.js` to validate the integration:

```bash
# Validate configuration
node test-rag-integration.js --validate-only

# Run mock tests
node test-rag-integration.js

# Test against real API
API_BASE=https://your-api.execute-api.us-west-2.amazonaws.com/dev node test-rag-integration.js
```

### Test Scenarios
1. **Fijian word lookup**: Tests exact dictionary retrieval
2. **Semantic search**: Tests fuzzy matching and context retrieval
3. **Fallback behavior**: Tests operation without RAG
4. **Mode compatibility**: Tests all chat modes (translation, learning, conversation)

## Deployment Considerations

### Environment Variables
Required for RAG functionality:
- `DICTIONARY_TABLE`: DynamoDB table name for exact lookups
- `OPENSEARCH_ENDPOINT`: OpenSearch cluster endpoint for semantic search
- `USER_PROGRESS_TABLE`: For tracking RAG usage in user progress

### Infrastructure Requirements
- **DynamoDB**: Dictionary table with word/language partition/sort keys
- **OpenSearch**: Dictionary index with embedding vectors and hybrid search capability
- **Bedrock**: Access to Claude 3 Haiku and Amazon Titan embedding models

## Usage Examples

### 1. Basic Fijian Learning
**Request**: "What does 'vinaka' mean?"
**RAG Process**: 
- Exact lookup: finds "vinaka" → "thank you"
- Semantic search: finds related gratitude expressions
- Context: Provides cultural usage notes

### 2. Translation Assistance
**Request**: "How do I say goodbye in Fijian?"
**RAG Process**:
- Semantic search: finds "goodbye" related entries
- Exact lookup: finds "moce" → "goodbye"
- Context: Provides formal vs informal usage

### 3. Conversation Practice
**Request**: "I want to greet someone politely"
**RAG Process**:
- Semantic search: finds greeting-related entries
- Context: Provides multiple greeting options with cultural context

## Future Enhancements

### 1. Advanced NLP
- **Morphological analysis**: Better Fijian word identification
- **Context-aware extraction**: Consider surrounding words for better lookups
- **Multi-word phrase recognition**: Handle compound expressions

### 2. Performance Optimization
- **Embedding caching**: Cache frequently used embeddings
- **Connection pooling**: Optimize database connections
- **Batch operations**: Group multiple lookups when possible

### 3. Enhanced Context
- **Usage frequency**: Weight by how commonly words are used
- **Difficulty scoring**: Prioritize simpler words for beginners
- **Regional variants**: Include dialectical variations

## Troubleshooting

### Common Issues

#### 1. No RAG Context Retrieved
**Symptoms**: `ragContext.entriesUsed = 0`
**Causes**: 
- OpenSearch index not populated
- DynamoDB table empty
- Network connectivity issues
**Solution**: Check infrastructure logs and verify data population

#### 2. Poor Context Relevance
**Symptoms**: Retrieved context doesn't match user query
**Causes**:
- Score threshold too low
- Embedding model mismatch
- Query preprocessing issues
**Solution**: Adjust `minScore` parameter or improve word extraction

#### 3. Response Timeouts
**Symptoms**: Slow API responses
**Causes**:
- OpenSearch query performance
- Too many dictionary entries retrieved
**Solution**: Reduce `maxEntries` or optimize search queries

### Monitoring and Observability

#### Key Metrics
- **RAG retrieval rate**: Percentage of requests that find relevant context
- **Response latency**: Impact of RAG on response times
- **Context usage**: How often retrieved context influences responses
- **Error rates**: Fallback behavior frequency

#### CloudWatch Logs
Look for log entries containing:
- `[handler] Retrieving RAG context`
- `[handler] Retrieved X RAG context entries`
- `Error retrieving RAG context`

## Conclusion

The RAG integration successfully enhances the Fijian chat pipeline with dictionary context while maintaining backward compatibility and robust fallback behavior. The implementation supports both exact and semantic lookups as required, with configurable parameters for different use cases.

The modular design allows for future enhancements while the current implementation provides immediate value for Fijian language learning and translation scenarios.