#!/usr/bin/env node

/**
 * Test Script for Article Content Storage
 * 
 * This script demonstrates the new article storage capabilities
 * by showing how articles and vocabulary are linked together.
 */

const { DynamoDBClient, GetItemCommand, ScanCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

// This would normally use environment variables in the Lambda
const ARTICLE_CONTENT_TABLE = 'FijianRagAppStack-ArticleContentTable-ABC123';
const VOCABULARY_FREQUENCY_TABLE = 'FijianRagAppStack-VocabularyFrequencyTable-XYZ789';

const ddbClient = new DynamoDBClient({ region: 'us-west-2' });

/**
 * Example: Retrieve an article and its vocabulary context
 */
async function demonstrateArticleRetrieval(articleId) {
  console.log(`\n=== Article Retrieval Demo ===`);
  console.log(`Looking up article: ${articleId}`);
  
  try {
    const result = await ddbClient.send(new GetItemCommand({
      TableName: ARTICLE_CONTENT_TABLE,
      Key: marshall({ articleId })
    }));
    
    if (result.Item) {
      const article = unmarshall(result.Item);
      
      console.log(`\nArticle Found:`);
      console.log(`Title: ${article.title || 'No title extracted'}`);
      console.log(`Source: ${article.source}`);
      console.log(`URL: ${article.url}`);
      console.log(`Word Count: ${article.wordCount}`);
      console.log(`Paragraphs: ${article.paragraphs.length}`);
      console.log(`Vocabulary Words Found: ${article.vocabularyWords.length}`);
      
      console.log(`\nFirst paragraph:`);
      console.log(`"${article.paragraphs[0].substring(0, 200)}..."`);
      
      console.log(`\nVocabulary Sample (first 10 words):`);
      console.log(article.vocabularyWords.slice(0, 10).join(', '));
      
      return article;
    } else {
      console.log('Article not found');
      return null;
    }
  } catch (error) {
    console.error('Error retrieving article:', error);
    return null;
  }
}

/**
 * Example: Find all articles from a specific source
 */
async function demonstrateSourceQuery(source) {
  console.log(`\n=== Source Query Demo ===`);
  console.log(`Finding articles from: ${source}`);
  
  try {
    const result = await ddbClient.send(new QueryCommand({
      TableName: ARTICLE_CONTENT_TABLE,
      IndexName: 'GSI_ArticleBySource',
      KeyConditionExpression: 'source = :source',
      ExpressionAttributeValues: marshall({
        ':source': source
      }),
      ScanIndexForward: false, // Most recent first
      Limit: 5 // Just show first 5
    }));
    
    console.log(`\nFound ${result.Items.length} articles:`);
    
    for (const item of result.Items) {
      const article = unmarshall(item);
      console.log(`- ${article.title || 'Untitled'} (${article.wordCount} words, ${new Date(article.processedAt).toLocaleDateString()})`);
    }
    
    return result.Items.map(item => unmarshall(item));
  } catch (error) {
    console.error('Error querying by source:', error);
    return [];
  }
}

/**
 * Example: Find vocabulary word with article context
 */
async function demonstrateVocabularyContext(word) {
  console.log(`\n=== Vocabulary Context Demo ===`);
  console.log(`Looking up word: "${word}"`);
  
  try {
    // Get vocabulary record
    const vocabResult = await ddbClient.send(new GetItemCommand({
      TableName: VOCABULARY_FREQUENCY_TABLE,
      Key: marshall({ word })
    }));
    
    if (vocabResult.Item) {
      const vocabRecord = unmarshall(vocabResult.Item);
      
      console.log(`\nVocabulary Record:`);
      console.log(`Word: ${vocabRecord.word}`);
      console.log(`Frequency: ${vocabRecord.frequency}`);
      console.log(`Definition: ${vocabRecord.definition || 'No definition found'}`);
      console.log(`Found in ${vocabRecord.articleIds?.length || 0} articles`);
      
      // Get first article containing this word
      if (vocabRecord.articleIds && vocabRecord.articleIds.length > 0) {
        const articleId = vocabRecord.articleIds[0];
        console.log(`\nRetrieving context from article: ${articleId}`);
        
        const articleResult = await ddbClient.send(new GetItemCommand({
          TableName: ARTICLE_CONTENT_TABLE,
          Key: marshall({ articleId })
        }));
        
        if (articleResult.Item) {
          const article = unmarshall(articleResult.Item);
          
          // Find paragraph containing the word
          const contextParagraph = article.paragraphs.find(p => 
            p.toLowerCase().includes(word.toLowerCase())
          );
          
          if (contextParagraph) {
            console.log(`\nContext from "${article.title || 'Untitled'}":`);
            console.log(`"${contextParagraph}"`);
          }
        }
      }
    } else {
      console.log('Word not found in vocabulary frequency table');
    }
  } catch (error) {
    console.error('Error looking up vocabulary context:', error);
  }
}

/**
 * Example: Learning session simulation
 */
async function demonstrateLearningSession(articleId) {
  console.log(`\n=== Learning Session Demo ===`);
  
  const article = await demonstrateArticleRetrieval(articleId);
  if (!article) return;
  
  console.log(`\n--- Simulated Learning Session ---`);
  console.log(`Article: ${article.title || 'Untitled'}`);
  console.log(`Reading level: ${article.vocabularyWords.length} unique words`);
  
  // Simulate paragraph-by-paragraph learning
  console.log(`\nPresenting paragraphs for comprehension:`);
  
  for (let i = 0; i < Math.min(3, article.paragraphs.length); i++) {
    const paragraph = article.paragraphs[i];
    console.log(`\nParagraph ${i + 1}:`);
    console.log(`"${paragraph.substring(0, 150)}..."`);
    
    // Find vocabulary words in this paragraph
    const wordsInParagraph = article.vocabularyWords.filter(word =>
      paragraph.toLowerCase().includes(word.toLowerCase())
    );
    
    console.log(`Vocabulary to review: ${wordsInParagraph.slice(0, 5).join(', ')}`);
    console.log(`[In a real app: Show definitions, test comprehension, track progress]`);
  }
}

/**
 * Main demo function
 */
async function runDemo() {
  console.log('='.repeat(60));
  console.log('Article Content Storage Demo');
  console.log('This demonstrates the RAG learning capabilities');
  console.log('='.repeat(60));
  
  // Note: These are example IDs - in real usage, these would come from actual processing
  const exampleArticleId = '1234567890abcdef'; // MD5 hash of a real URL
  const exampleSource = 'Nai Lalakai';
  const exampleWord = 'bula';
  
  console.log('\nNOTE: This demo uses example data. In production:');
  console.log('1. Run vocabulary processing Lambda with real Fijian article URLs');
  console.log('2. Articles and vocabulary will be automatically stored');
  console.log('3. Use these functions to build RAG learning experiences');
  
  // Demonstrate key functionality
  await demonstrateSourceQuery(exampleSource);
  await demonstrateVocabularyContext(exampleWord);
  await demonstrateLearningSession(exampleArticleId);
  
  console.log(`\n=== Demo Complete ===`);
  console.log('Ready to implement RAG-based Fijian language learning!');
}

// Run the demo if called directly
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = {
  demonstrateArticleRetrieval,
  demonstrateSourceQuery,
  demonstrateVocabularyContext,
  demonstrateLearningSession
};