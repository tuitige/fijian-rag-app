# Article Content Storage for RAG Learning

## Overview

The Fijian RAG App now stores complete article content alongside vocabulary frequency data, enabling sophisticated RAG-based language learning experiences. When processing article URLs, the system extracts and stores the full text, individual paragraphs, and metadata for future educational use.

## ArticleContentTable Schema

### Primary Key
- **Partition Key**: `articleId` (string) - MD5 hash of the article URL

### Attributes
- `url` (string) - Original article URL
- `title` (string, optional) - Extracted article title
- `content` (string) - Full article text content
- `paragraphs` (list of strings) - Individual paragraphs (max 50)
- `processedAt` (string) - ISO timestamp when processed
- `source` (string) - Publication source (e.g., "Nai Lalakai", "Fiji Times")
- `language` (string) - Always "fijian" (prepared for multi-language support)
- `wordCount` (number) - Total words in article
- `vocabularyWords` (list of strings) - Unique Fijian words found
- `metadata` (map) - Additional metadata (paragraph count, extraction flags)

### Global Secondary Indexes

1. **GSI_ArticleByUrl**
   - Partition Key: `url`
   - Use Case: Look up existing articles by URL to avoid duplicates

2. **GSI_ArticleBySource**
   - Partition Key: `source`
   - Sort Key: `processedAt`
   - Use Case: Browse articles by publication and chronological order

## Integration with Vocabulary Processing

### Enhanced Vocabulary Records
Vocabulary frequency records now include:
- `articleIds` (list of strings) - References to articles containing each word
- Cross-linking enables finding source context for any vocabulary word

### Article ID Generation
```typescript
function generateArticleId(url: string): string {
  return createHash('md5').update(url).digest('hex');
}
```

## Content Extraction Features

### Smart Title Extraction
The system attempts to extract article titles using multiple HTML selectors:
- `h1.article-title`, `h1.post-title`, `h1.entry-title`
- `.article-header h1`, `article h1`
- Generic `h1`, `title` as fallbacks

### Source Identification
Automatic recognition of major Fijian news sources:
- `nailalakai.com.fj` → "Nai Lalakai"
- `fijitimes.com` → "Fiji Times"
- `fijivillage.com` → "FijiVillage"
- `fbcnews.com.fj` → "FBC News"
- `fijisun.com.fj` → "Fiji Sun"

### Paragraph Segmentation
- Splits content on double newlines (`\n\s*\n`)
- Filters paragraphs shorter than 20 characters
- Limits to 50 paragraphs to respect DynamoDB item size limits
- Enables granular, paragraph-by-paragraph learning exercises

## RAG Learning Use Cases

### Article-Guided Learning
1. **Comprehension Testing**: Present paragraphs sequentially, test understanding
2. **Vocabulary in Context**: Highlight words with dictionary definitions
3. **Progressive Difficulty**: Start with high-frequency words, advance to rare terms
4. **Cultural Context**: Use real news articles for authentic language exposure

### Technical Implementation
```typescript
// Retrieve article for learning session
const article = await ddbClient.send(new GetItemCommand({
  TableName: process.env.ARTICLE_CONTENT_TABLE,
  Key: marshall({ articleId: "a1b2c3d4..." })
}));

// Get vocabulary words used in this article
const vocabularyWords = article.Item.vocabularyWords;

// Present paragraph-by-paragraph with annotations
for (const paragraph of article.Item.paragraphs) {
  // Highlight vocabulary words
  // Provide dictionary definitions
  // Test comprehension
}
```

### Query Patterns

#### Find Articles by Publication
```typescript
const articles = await ddbClient.send(new QueryCommand({
  TableName: process.env.ARTICLE_CONTENT_TABLE,
  IndexName: 'GSI_ArticleBySource',
  KeyConditionExpression: 'source = :source',
  ExpressionAttributeValues: marshall({
    ':source': 'Nai Lalakai'
  }),
  ScanIndexForward: false // Most recent first
}));
```

#### Find Articles Containing Specific Words
```typescript
const articles = await ddbClient.send(new ScanCommand({
  TableName: process.env.ARTICLE_CONTENT_TABLE,
  FilterExpression: 'contains(vocabularyWords, :word)',
  ExpressionAttributeValues: marshall({
    ':word': 'bula'
  })
}));
```

## API Response Enhancement

The vocabulary processing API now returns:
```json
{
  "message": "Vocabulary processing completed successfully",
  "results": {
    "articlesProcessed": 3,
    "totalWordsFound": 1250,
    "uniqueWordsFound": 285,
    "articlesStored": 3,
    "urlsRequested": 3
  }
}
```

## Storage Considerations

### DynamoDB Limits
- Maximum item size: 400KB
- Paragraph arrays limited to 50 items
- Content truncation for very long articles may be needed

### Cost Optimization
- Pay-per-request billing mode
- Consider archiving old articles to reduce storage costs
- Use point-in-time recovery for data protection

## Future Enhancements

### Planned Features
1. **Content Versioning**: Track article updates over time
2. **Reading Level Analysis**: Classify articles by difficulty
3. **Topic Categorization**: Auto-tag articles by subject matter
4. **Audio Integration**: Link to pronunciation for vocabulary words
5. **User Progress Tracking**: Record which articles/paragraphs completed

### Potential Integrations
- **Text-to-Speech**: Generate audio for listening exercises
- **Translation Exercises**: Compare Fijian/English versions
- **Quiz Generation**: Automatic comprehension questions
- **Personalized Learning**: Recommend articles based on vocabulary level

## Monitoring and Analytics

### Useful Metrics
- Articles processed per day/week
- Most common source publications
- Average words per article by source
- Vocabulary coverage across all articles
- Popular articles for learning (future feature)

### CloudWatch Queries
Monitor vocabulary processing Lambda for:
- Processing time per article
- Content extraction success rates
- Storage errors or failures
- Article deduplication effectiveness