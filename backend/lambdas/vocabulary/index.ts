/**
 * Fijian Article Vocabulary Frequency & Dictionary Enrichment Lambda
 * 
 * This Lambda function:
 * - Accepts an array of Fijian article URLs
 * - Fetches and processes each article, extracting all Fijian words
 * - Tokenizes and counts word frequencies across all articles
 * - Stores/updates records in DynamoDB with frequency, sources, and dictionary definitions
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';

const ddbClient = new DynamoDBClient({});

interface VocabularyRequest {
  urls: string[];
}

interface VocabularyRecord {
  word: string;
  frequency: number;
  sources: string[];
  lastSeen: string;
  definition?: string;
  context?: string;
  articleIds?: string[]; // New: Reference to articles containing this word
}

interface ArticleRecord {
  articleId: string;
  url: string;
  title?: string;
  content: string;
  paragraphs: string[];
  processedAt: string;
  source?: string;
  language: string;
  wordCount: number;
  vocabularyWords: string[];
  metadata?: { [key: string]: any };
}

interface WordFrequency {
  [word: string]: {
    count: number;
    sources: Set<string>;
    contexts: string[];
    articleIds: Set<string>; // New: Track which articles contain this word
  };
}

/**
 * Generate a unique article ID from URL
 */
function generateArticleId(url: string): string {
  return createHash('md5').update(url).digest('hex');
}

/**
 * Extract article title from HTML
 */
function extractArticleTitle(html: string): string | undefined {
  const $ = cheerio.load(html);
  
  // Try various title selectors
  const titleSelectors = [
    'h1.article-title',
    'h1.post-title',
    'h1.entry-title',
    '.article-header h1',
    'article h1',
    'h1',
    'title'
  ];
  
  for (const selector of titleSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const title = element.text().trim();
      if (title && title.length > 0 && title.length < 200) {
        return title;
      }
    }
  }
  
  return undefined;
}

/**
 * Extract source/publication name from URL
 */
function extractSourceFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    
    // Map known Fijian news sources
    const sourceMap: { [key: string]: string } = {
      'nailalakai.com.fj': 'Nai Lalakai',
      'fijitimes.com': 'Fiji Times',
      'fijivillage.com': 'FijiVillage',
      'fbcnews.com.fj': 'FBC News',
      'fijisun.com.fj': 'Fiji Sun'
    };
    
    // Check exact matches first
    if (sourceMap[hostname]) {
      return sourceMap[hostname];
    }
    
    // Extract domain name as fallback
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
    }
    
    return hostname;
  } catch (error) {
    return 'Unknown Source';
  }
}

/**
 * Split text into paragraphs for granular learning
 */
function extractParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/) // Split on double newlines
    .map(p => p.trim())
    .filter(p => p.length > 20) // Filter out very short paragraphs
    .slice(0, 50); // Limit to 50 paragraphs to avoid DynamoDB size limits
}

/**
 * Store article content in DynamoDB
 */
async function storeArticleContent(
  articleId: string,
  url: string,
  title: string | undefined,
  content: string,
  vocabularyWords: string[]
): Promise<void> {
  try {
    const paragraphs = extractParagraphs(content);
    const source = extractSourceFromUrl(url);
    const now = new Date().toISOString();
    
    const articleRecord: ArticleRecord = {
      articleId,
      url,
      title,
      content,
      paragraphs,
      processedAt: now,
      source,
      language: 'fijian',
      wordCount: content.split(/\s+/).length,
      vocabularyWords,
      metadata: {
        paragraphCount: paragraphs.length,
        extractedTitle: !!title
      }
    };
    
    await ddbClient.send(new PutItemCommand({
      TableName: process.env.ARTICLE_CONTENT_TABLE!,
      Item: marshall(articleRecord)
    }));
    
    console.log(`Stored article content: ${articleId} (${content.length} chars, ${paragraphs.length} paragraphs)`);
  } catch (error) {
    console.error(`Error storing article content for ${articleId}:`, error);
  }
}

/**
 * Validate if string looks like a Fijian word
 * Based on the existing dictionary parser logic
 */
export function isValidFijianWord(word: string): boolean {
  // Basic validation for Fijian phonology
  // Fijian typically uses: a, e, i, o, u, b, c, d, f, g, j, k, l, m, n, p, q, r, s, t, v, w, y
  const fijianPattern = /^[abcdefgijklmnpqrstuvwy]+$/i;
  
  return word.length >= 2 && 
         word.length <= 20 && 
         fijianPattern.test(word) &&
         /[aeiou]/i.test(word); // Must contain at least one vowel
}

/**
 * Tokenize text and extract Fijian words
 */
export function tokenizeFijianText(text: string): string[] {
  // Split on whitespace and punctuation, clean up
  const words = text
    .toLowerCase()
    .split(/[\s\p{P}]+/u) // Split on Unicode punctuation and whitespace
    .map(word => word.trim())
    .filter(word => word.length > 0)
    .filter(isValidFijianWord);
  
  return words;
}

/**
 * Extract text content from HTML using cheerio
 */
export function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);
  
  // Remove script and style elements
  $('script, style, nav, header, footer, .advertisement, .ads').remove();
  
  // Extract main content - prioritize article content areas
  const contentSelectors = [
    'article',
    '.article-content',
    '.post-content', 
    '.entry-content',
    '.content',
    'main',
    '.main-content',
    '#content'
  ];
  
  let text = '';
  
  // Try each selector to find the main content
  for (const selector of contentSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      text = element.text();
      break;
    }
  }
  
  // Fallback to body if no content found
  if (!text) {
    text = $('body').text();
  }
  
  // Clean up the text
  return text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Fetch article content from URL
 */
async function fetchArticleContent(url: string): Promise<{ content: string; title?: string; html: string }> {
  try {
    console.log(`Fetching article: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 30000, // 30 seconds timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const html = response.data;
    const content = extractTextFromHtml(html);
    const title = extractArticleTitle(html);
    
    console.log(`Extracted ${content.length} characters from ${url}${title ? ` (title: ${title})` : ''}`);
    
    return { content, title, html };
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return { content: '', html: '' };
  }
}

/**
 * Look up word in dictionary table
 */
async function lookupWordInDictionary(word: string): Promise<{ definition?: string; context?: string }> {
  try {
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
        context: item.part_of_speech ? `${item.part_of_speech}. ${item.english_translation || item.definition}` : undefined
      };
    }
    
    return {};
  } catch (error) {
    console.error(`Error looking up word ${word}:`, error);
    return {};
  }
}

/**
 * Update vocabulary frequency record in DynamoDB
 */
async function updateVocabularyRecord(
  word: string, 
  frequency: number, 
  sources: string[], 
  contexts: string[],
  articleIds: string[]
): Promise<void> {
  try {
    // Look up dictionary definition
    const dictEntry = await lookupWordInDictionary(word);
    
    const now = new Date().toISOString();
    const contextSnippet = contexts.length > 0 ? contexts[0].substring(0, 200) : undefined;
    
    // Check if record exists
    const existingResult = await ddbClient.send(new GetItemCommand({
      TableName: process.env.VOCABULARY_FREQUENCY_TABLE!,
      Key: marshall({ word })
    }));
    
    if (existingResult.Item) {
      // Update existing record
      const existing = unmarshall(existingResult.Item) as VocabularyRecord;
      
      // Merge sources and articleIds (deduplicate)
      const mergedSources = Array.from(new Set([...existing.sources, ...sources]));
      const mergedArticleIds = Array.from(new Set([...(existing.articleIds || []), ...articleIds]));
      const newFrequency = existing.frequency + frequency;
      
      await ddbClient.send(new UpdateItemCommand({
        TableName: process.env.VOCABULARY_FREQUENCY_TABLE!,
        Key: marshall({ word }),
        UpdateExpression: 'SET frequency = :freq, #sources = :sources, lastSeen = :lastSeen, articleIds = :articleIds' + 
                         (dictEntry.definition ? ', #definition = :def' : '') +
                         (dictEntry.context ? ', #context = :ctx' : '') +
                         (contextSnippet ? ', articleContext = :artCtx' : ''),
        ExpressionAttributeNames: {
          '#sources': 'sources',
          ...(dictEntry.definition && { '#definition': 'definition' }),
          ...(dictEntry.context && { '#context': 'context' })
        },
        ExpressionAttributeValues: marshall({
          ':freq': newFrequency,
          ':sources': mergedSources,
          ':lastSeen': now,
          ':articleIds': mergedArticleIds,
          ...(dictEntry.definition && { ':def': dictEntry.definition }),
          ...(dictEntry.context && { ':ctx': dictEntry.context }),
          ...(contextSnippet && { ':artCtx': contextSnippet })
        })
      }));
      
      console.log(`Updated ${word}: frequency ${existing.frequency} -> ${newFrequency}, articles: ${mergedArticleIds.length}`);
    } else {
      // Create new record
      const record: VocabularyRecord = {
        word,
        frequency,
        sources,
        lastSeen: now,
        articleIds,
        ...(dictEntry.definition && { definition: dictEntry.definition }),
        ...(dictEntry.context && { context: dictEntry.context })
      };
      
      const item = marshall({
        ...record,
        ...(contextSnippet && { articleContext: contextSnippet })
      });
      
      await ddbClient.send(new PutItemCommand({
        TableName: process.env.VOCABULARY_FREQUENCY_TABLE!,
        Item: item
      }));
      
      console.log(`Created new record for ${word}: frequency ${frequency}, articles: ${articleIds.length}`);
    }
  } catch (error) {
    console.error(`Error updating vocabulary record for ${word}:`, error);
  }
}

/**
 * Process articles and update vocabulary frequencies
 */
async function processArticles(urls: string[]): Promise<{ 
  processed: number; 
  totalWords: number; 
  uniqueWords: number; 
  articlesStored: number 
}> {
  const wordFrequencies: WordFrequency = {};
  let processedCount = 0;
  let articlesStored = 0;
  
  // Process each article
  for (const url of urls) {
    try {
      const articleData = await fetchArticleContent(url);
      if (!articleData.content) {
        console.log(`Skipping ${url} - no content extracted`);
        continue;
      }
      
      const articleId = generateArticleId(url);
      const words = tokenizeFijianText(articleData.content);
      console.log(`Extracted ${words.length} Fijian words from ${url}`);
      
      // Count word frequencies for this article
      for (const word of words) {
        if (!wordFrequencies[word]) {
          wordFrequencies[word] = {
            count: 0,
            sources: new Set(),
            contexts: [],
            articleIds: new Set()
          };
        }
        
        wordFrequencies[word].count++;
        wordFrequencies[word].sources.add(url);
        wordFrequencies[word].articleIds.add(articleId);
        
        // Store context snippet (sentence containing the word)
        const sentences = articleData.content.split(/[.!?]+/);
        const contextSentence = sentences.find(s => s.toLowerCase().includes(word));
        if (contextSentence && wordFrequencies[word].contexts.length < 3) {
          wordFrequencies[word].contexts.push(contextSentence.trim());
        }
      }
      
      // Store the article content
      await storeArticleContent(
        articleId,
        url,
        articleData.title,
        articleData.content,
        [...new Set(words)] // Unique words found in this article
      );
      
      articlesStored++;
      processedCount++;
    } catch (error) {
      console.error(`Error processing article ${url}:`, error);
    }
  }
  
  // Update DynamoDB vocabulary records
  const uniqueWords = Object.keys(wordFrequencies).length;
  let totalWords = 0;
  
  console.log(`Updating ${uniqueWords} unique words in DynamoDB...`);
  
  for (const [word, data] of Object.entries(wordFrequencies)) {
    totalWords += data.count;
    await updateVocabularyRecord(
      word, 
      data.count, 
      Array.from(data.sources), 
      data.contexts,
      Array.from(data.articleIds)
    );
  }
  
  return {
    processed: processedCount,
    totalWords,
    uniqueWords,
    articlesStored
  };
}

/**
 * Lambda handler
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Vocabulary processing Lambda triggered', JSON.stringify(event, null, 2));
  
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Request body is required'
        })
      };
    }
    
    const request: VocabularyRequest = JSON.parse(event.body);
    
    if (!request.urls || !Array.isArray(request.urls) || request.urls.length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'urls array is required and must not be empty'
        })
      };
    }
    
    console.log(`Processing ${request.urls.length} article URLs...`);
    
    const results = await processArticles(request.urls);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Vocabulary processing completed successfully',
        results: {
          articlesProcessed: results.processed,
          totalWordsFound: results.totalWords,
          uniqueWordsFound: results.uniqueWords,
          articlesStored: results.articlesStored,
          urlsRequested: request.urls.length
        }
      })
    };
    
  } catch (error) {
    console.error('Error processing vocabulary:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};