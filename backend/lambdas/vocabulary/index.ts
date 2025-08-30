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
}

interface WordFrequency {
  [word: string]: {
    count: number;
    sources: Set<string>;
    contexts: string[];
  };
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
async function fetchArticleContent(url: string): Promise<string> {
  try {
    console.log(`Fetching article: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 30000, // 30 seconds timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const text = extractTextFromHtml(response.data);
    console.log(`Extracted ${text.length} characters from ${url}`);
    
    return text;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return '';
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
async function updateVocabularyRecord(word: string, frequency: number, sources: string[], contexts: string[]): Promise<void> {
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
      
      // Merge sources (deduplicate)
      const mergedSources = Array.from(new Set([...existing.sources, ...sources]));
      const newFrequency = existing.frequency + frequency;
      
      await ddbClient.send(new UpdateItemCommand({
        TableName: process.env.VOCABULARY_FREQUENCY_TABLE!,
        Key: marshall({ word }),
        UpdateExpression: 'SET frequency = :freq, sources = :sources, lastSeen = :lastSeen' + 
                         (dictEntry.definition ? ', definition = :def' : '') +
                         (dictEntry.context ? ', context = :ctx' : '') +
                         (contextSnippet ? ', articleContext = :artCtx' : ''),
        ExpressionAttributeValues: marshall({
          ':freq': newFrequency,
          ':sources': mergedSources,
          ':lastSeen': now,
          ...(dictEntry.definition && { ':def': dictEntry.definition }),
          ...(dictEntry.context && { ':ctx': dictEntry.context }),
          ...(contextSnippet && { ':artCtx': contextSnippet })
        })
      }));
      
      console.log(`Updated ${word}: frequency ${existing.frequency} -> ${newFrequency}`);
    } else {
      // Create new record
      const record: VocabularyRecord = {
        word,
        frequency,
        sources,
        lastSeen: now,
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
      
      console.log(`Created new record for ${word}: frequency ${frequency}`);
    }
  } catch (error) {
    console.error(`Error updating vocabulary record for ${word}:`, error);
  }
}

/**
 * Process articles and update vocabulary frequencies
 */
async function processArticles(urls: string[]): Promise<{ processed: number; totalWords: number; uniqueWords: number }> {
  const wordFrequencies: WordFrequency = {};
  let processedCount = 0;
  
  // Process each article
  for (const url of urls) {
    try {
      const content = await fetchArticleContent(url);
      if (!content) {
        console.log(`Skipping ${url} - no content extracted`);
        continue;
      }
      
      const words = tokenizeFijianText(content);
      console.log(`Extracted ${words.length} Fijian words from ${url}`);
      
      // Count word frequencies for this article
      for (const word of words) {
        if (!wordFrequencies[word]) {
          wordFrequencies[word] = {
            count: 0,
            sources: new Set(),
            contexts: []
          };
        }
        
        wordFrequencies[word].count++;
        wordFrequencies[word].sources.add(url);
        
        // Store context snippet (sentence containing the word)
        const sentences = content.split(/[.!?]+/);
        const contextSentence = sentences.find(s => s.toLowerCase().includes(word));
        if (contextSentence && wordFrequencies[word].contexts.length < 3) {
          wordFrequencies[word].contexts.push(contextSentence.trim());
        }
      }
      
      processedCount++;
    } catch (error) {
      console.error(`Error processing article ${url}:`, error);
    }
  }
  
  // Update DynamoDB records
  const uniqueWords = Object.keys(wordFrequencies).length;
  let totalWords = 0;
  
  console.log(`Updating ${uniqueWords} unique words in DynamoDB...`);
  
  for (const [word, data] of Object.entries(wordFrequencies)) {
    totalWords += data.count;
    await updateVocabularyRecord(
      word, 
      data.count, 
      Array.from(data.sources), 
      data.contexts
    );
  }
  
  return {
    processed: processedCount,
    totalWords,
    uniqueWords
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