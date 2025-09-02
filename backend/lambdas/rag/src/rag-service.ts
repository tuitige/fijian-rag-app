/**
 * RAG Service for RAG Handler - Fijian Dictionary Integration
 * 
 * This module provides RAG functionality for the RAG handler.
 * It integrates dictionary retrieval (semantic and exact lookups) with LLM context augmentation.
 */

import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { hybridSearch, createEmbedding } from '../../dictionary/opensearch';

// Initialize DynamoDB client
const ddbClient = new DynamoDBClient({});

// Environment variables
const DICTIONARY_TABLE = process.env.DICTIONARY_TABLE!;

/**
 * Interface for dictionary search results
 */
export interface DictionaryEntry {
  word?: string;
  fijian_word?: string;
  fijian?: string;
  english_translation?: string;
  english?: string;
  part_of_speech?: string;
  explanation?: string;
  usageNotes?: string;
  score?: number;
}

/**
 * RAG context configuration options
 */
export interface RagContextOptions {
  /** Maximum number of dictionary entries to retrieve */
  maxEntries?: number;
  /** Minimum relevance score threshold */
  minScore?: number;
  /** Whether to include exact word lookups */
  includeExactLookup?: boolean;
  /** Whether to include semantic search */
  includeSemanticSearch?: boolean;
}

/**
 * Result of RAG context retrieval
 */
export interface RagContextResult {
  entries: DictionaryEntry[];
  contextText: string;
  sourcesSummary: Array<{ word: string; score?: number; type: 'exact' | 'semantic' }>;
}

/**
 * Looks up a word exactly in the dictionary table
 */
export async function lookupWordExact(word: string, language: string = 'fijian'): Promise<DictionaryEntry | null> {
  try {
    const params = {
      TableName: DICTIONARY_TABLE,
      Key: marshall({
        word: word.toLowerCase(),
        language: language
      })
    };

    const result = await ddbClient.send(new GetItemCommand(params));
    
    if (!result.Item) {
      return null;
    }

    return unmarshall(result.Item) as DictionaryEntry;
  } catch (error) {
    console.error('Error looking up word exactly:', error);
    return null;
  }
}

/**
 * Searches dictionary using OpenSearch for fuzzy matching and semantic search
 */
export async function searchDictionarySemantic(query: string, limit: number = 10): Promise<DictionaryEntry[]> {
  try {
    // Create embedding for semantic search
    const embedding = await createEmbedding(query);
    
    // Perform hybrid search (text + semantic)
    const results = await hybridSearch({
      index: 'dictionary',
      query: query,
      embedding: embedding,
      size: limit
    });

    return results.map((hit: any) => ({
      ...hit._source,
      score: hit._score
    }));
  } catch (error) {
    console.error('Error searching dictionary semantically:', error);
    return [];
  }
}

/**
 * Extracts potential Fijian words from user query for exact lookup
 */
export function extractFijianWords(query: string): string[] {
  const words = query
    .toLowerCase()
    .split(/[\s.,!?;:]+/)
    .filter(word => word.length >= 2 && word.length <= 20)
    .filter(word => /^[a-z]+$/.test(word));
  
  return words;
}

/**
 * Retrieves comprehensive RAG context for a user query
 */
export async function retrieveRagContext(
  query: string, 
  options: RagContextOptions = {}
): Promise<RagContextResult> {
  const {
    maxEntries = 5,
    minScore = 0.1,
    includeExactLookup = true,
    includeSemanticSearch = true
  } = options;

  const allEntries: DictionaryEntry[] = [];
  const sourcesSummary: Array<{ word: string; score?: number; type: 'exact' | 'semantic' }> = [];

  // 1. Exact word lookups
  if (includeExactLookup) {
    const potentialWords = extractFijianWords(query);
    
    for (const word of potentialWords.slice(0, 3)) {
      const exactEntry = await lookupWordExact(word);
      if (exactEntry) {
        allEntries.push(exactEntry);
        sourcesSummary.push({ word, type: 'exact' });
      }
    }
  }

  // 2. Semantic search for additional context
  if (includeSemanticSearch) {
    const semanticEntries = await searchDictionarySemantic(query, maxEntries);
    
    for (const entry of semanticEntries) {
      const word = entry.fijian_word || entry.fijian || entry.word;
      const isDuplicate = allEntries.some(existing => 
        (existing.fijian_word || existing.fijian || existing.word) === word
      );
      
      if (!isDuplicate && (entry.score || 1) >= minScore) {
        allEntries.push(entry);
        sourcesSummary.push({ 
          word: word || 'unknown', 
          score: entry.score, 
          type: 'semantic' 
        });
      }
    }
  }

  // 3. Limit to maxEntries and format context
  const finalEntries = allEntries.slice(0, maxEntries);
  const contextText = formatDictionaryContext(finalEntries);

  return {
    entries: finalEntries,
    contextText,
    sourcesSummary: sourcesSummary.slice(0, maxEntries)
  };
}

/**
 * Formats dictionary entries into context text for LLM prompts
 */
export function formatDictionaryContext(entries: DictionaryEntry[]): string {
  if (entries.length === 0) {
    return '';
  }

  return entries.map(entry => {
    const fijianWord = entry.fijian_word || entry.fijian || entry.word || 'Unknown';
    const englishTranslation = entry.english_translation || entry.english || 'No translation available';
    const explanation = entry.explanation || entry.usageNotes || '';
    const partOfSpeech = entry.part_of_speech ? `(${entry.part_of_speech})` : '';
    
    return `Fijian: ${fijianWord} ${partOfSpeech}\nEnglish: ${englishTranslation}${explanation ? `\nNotes: ${explanation}` : ''}`;
  }).join('\n\n');
}