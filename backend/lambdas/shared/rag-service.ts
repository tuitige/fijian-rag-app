/**
 * Shared RAG Service for Fijian Dictionary Integration
 * 
 * This module provides reusable RAG functionality for both chat and RAG handlers.
 * It integrates dictionary retrieval (semantic and exact lookups) with LLM context augmentation.
 * 
 * Key features:
 * - Dictionary search using OpenSearch (semantic/fuzzy matching)
 * - Exact word lookup using DynamoDB
 * - Context formatting for LLM prompts
 * - Configurable retrieval strategies
 */

import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { hybridSearch, createEmbedding } from '../dictionary/opensearch';

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
 * Common Fijian function words that should be deprioritized in lookup
 */
const FIJIAN_FUNCTION_WORDS = new Set([
  'na', 'ko', 'e', 'me', 'ni', 'ka', 'kei', 'i', 'o', 'vei', 'mai', 'yani',
  'tiko', 'tu', 'ga', 'sara', 'tale', 'beka', 'soti', 'what', 'does', 'is',
  'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'how', 'why', 'when', 'where', 'who', 'mean', 'means', 'called', 'do',
  'you', 'say', 'meaning', 'definition'
]);

/**
 * Extracts and prioritizes potential Fijian words from user query for exact lookup
 * Enhanced to handle question patterns and prioritize content words
 */
export function extractFijianWords(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  
  // Handle question patterns - prioritize words being asked about
  const questionPatterns = [
    /what\s+(?:does|is)\s+([a-z]+)\s+mean/i,           // "what does X mean"
    /what\s+is\s+(?:the\s+)?(?:meaning\s+of\s+)?([a-z]+)/i,  // "what is X" or "what is the meaning of X"
    /(?:meaning|definition)\s+of\s+([a-z]+)/i,         // "meaning of X"
    /how\s+do\s+you\s+say\s+([a-z]+)/i,               // "how do you say X"
    /translate\s+([a-z]+)/i                            // "translate X"
  ];
  
  // Check for question patterns first
  for (const pattern of questionPatterns) {
    const match = lowerQuery.match(pattern);
    if (match && match[1]) {
      const targetWord = match[1];
      if (targetWord.length >= 2 && targetWord.length <= 20 && !FIJIAN_FUNCTION_WORDS.has(targetWord)) {
        // Prioritize the questioned word, then add other potential words
        const otherWords = extractAllWords(lowerQuery)
          .filter(word => word !== targetWord && !FIJIAN_FUNCTION_WORDS.has(word));
        return [targetWord, ...otherWords].slice(0, 5); // Limit to 5 total words
      }
    }
  }
  
  // Default extraction with prioritization
  const allWords = extractAllWords(lowerQuery);
  
  // Separate content words from function words
  const contentWords = allWords.filter(word => !FIJIAN_FUNCTION_WORDS.has(word));
  const functionWords = allWords.filter(word => FIJIAN_FUNCTION_WORDS.has(word));
  
  // Prioritize content words, then add function words if needed
  return [...contentWords, ...functionWords].slice(0, 5); // Limit to 5 words max
}

/**
 * Helper function to extract all valid words from query
 */
function extractAllWords(query: string): string[] {
  return query
    .split(/[\s.,!?;:\-@]+/)  // Added - and @ to split patterns
    .map(word => word.trim())
    .filter(word => word.length >= 2 && word.length <= 20)
    .filter(word => /^[a-z]+$/.test(word)); // Basic filter for alphabetic words
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
    
    // Look up all prioritized words (now limited to 5 in extraction)
    for (const word of potentialWords) {
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
    
    // Add semantic entries that aren't already included from exact lookups
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

/**
 * Augments a user prompt with dictionary context for RAG
 */
export function augmentPromptWithContext(
  originalPrompt: string,
  contextResult: RagContextResult,
  systemContext?: string
): string {
  if (contextResult.entries.length === 0) {
    return originalPrompt;
  }

  const contextSection = `
Relevant Dictionary Context:
${contextResult.contextText}

`;

  const augmentedPrompt = systemContext 
    ? `${systemContext}\n\n${contextSection}User Question: ${originalPrompt}`
    : `${contextSection}${originalPrompt}`;

  return augmentedPrompt;
}

/**
 * Creates a RAG-enhanced system prompt for different chat modes
 */
export function createRagSystemPrompt(mode: string, direction?: string): string {
  const baseContext = "You are a helpful Fijian language learning assistant. You have access to some dictionary entries that may be relevant to the user's question. Use the provided dictionary context when available, but do not limit yourself to only this context. If the dictionary context is incomplete or doesn't fully answer the user's question, supplement it with your own knowledge of the Fijian language. Always provide the most helpful and complete response possible.";
  
  switch (mode) {
    case 'translation':
      const directionText = direction === 'fj-en' ? 'from Fijian to English' :
                           direction === 'en-fj' ? 'from English to Fijian' :
                           'automatically detecting the language and translating appropriately';
      
      return `${baseContext} Your task is to provide accurate translations ${directionText}. Use the dictionary context when available to ensure accuracy, but supplement with your broader knowledge of Fijian language and culture when the dictionary context is insufficient. Provide cultural nuances and alternative translations when relevant.`;

    case 'learning':
      return `${baseContext} Your role is to help learners understand Fijian language, grammar, and culture. Use the dictionary context when available to provide accurate definitions and examples, but expand beyond it with your knowledge of Fijian grammar, usage patterns, and cultural context. Provide comprehensive explanations even if the dictionary context is limited.`;

    case 'conversation':
      return `${baseContext} You help users practice natural conversation in both Fijian and English. Use the dictionary context when available for accurate vocabulary guidance, but draw upon your full knowledge of both languages to maintain natural, flowing conversation. Don't restrict responses to only dictionary-defined words.`;

    default:
      return baseContext;
  }
}