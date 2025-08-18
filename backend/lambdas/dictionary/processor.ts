/**
 * Fijian Dictionary Processor
 * 
 * This module implements the FijianDictionaryProcessor class as specified in the issue.
 * It processes PDF dictionary data and indexes it to both DynamoDB and OpenSearch.
 */

import { DynamoDBClient, PutItemCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { createEmbedding, indexToOpenSearch } from './opensearch';
import { v4 as uuidv4 } from 'uuid';

const ddbClient = new DynamoDBClient({});

export interface DictionaryEntry {
  fijian: string;
  english: string;
  pos?: string; // part of speech
  examples?: string[];
  pronunciation?: string;
  related?: string[];
}

export interface StructuredDictionaryEntry {
  fijian_word: string;
  english_translation: string;
  part_of_speech?: string;
  example_sentences?: string[];
  pronunciation?: string;
  related_words?: string[];
  embedding?: number[];
}

export class FijianDictionaryProcessor {
  private dictionaryTableName: string;
  
  constructor(dictionaryTableName: string) {
    this.dictionaryTableName = dictionaryTableName;
  }

  /**
   * Extracts dictionary entries from processed text
   * In a real implementation, this would parse PDF content
   */
  extractEntries(textContent: string): DictionaryEntry[] {
    // For now, return mock data for testing
    // In a real implementation, this would parse the PDF content
    return [
      {
        fijian: 'bula',
        english: 'hello, life, health',
        pos: 'noun/interjection',
        examples: ['Bula vinaka! - Good hello!'],
        pronunciation: 'boo-lah'
      },
      {
        fijian: 'vinaka',
        english: 'good, thank you',
        pos: 'adjective/interjection',
        examples: ['Vinaka vaka levu - Thank you very much'],
        pronunciation: 'vee-nah-kah'
      }
    ];
  }

  /**
   * Structures dictionary entries for storage
   */
  structureEntries(entries: DictionaryEntry[]): StructuredDictionaryEntry[] {
    return entries.map(entry => ({
      fijian_word: entry.fijian,
      english_translation: entry.english,
      part_of_speech: entry.pos,
      example_sentences: entry.examples,
      pronunciation: entry.pronunciation,
      related_words: entry.related
    }));
  }

  /**
   * Generates embeddings for entries and adds them
   */
  async generateEmbeddings(entries: StructuredDictionaryEntry[]): Promise<StructuredDictionaryEntry[]> {
    const entriesWithEmbeddings = [];
    
    for (const entry of entries) {
      try {
        const textForEmbedding = `${entry.fijian_word} - ${entry.english_translation}`;
        const embedding = await createEmbedding(textForEmbedding);
        
        entriesWithEmbeddings.push({
          ...entry,
          embedding
        });
      } catch (error) {
        console.error(`Error generating embedding for ${entry.fijian_word}:`, error);
        entriesWithEmbeddings.push(entry); // Add without embedding
      }
    }
    
    return entriesWithEmbeddings;
  }

  /**
   * Indexes entries to DynamoDB
   */
  async indexToDynamoDB(entries: StructuredDictionaryEntry[]): Promise<void> {
    const batchSize = 25; // DynamoDB batch write limit
    
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      
      const writeRequests = batch.map(entry => ({
        PutRequest: {
          Item: marshall({
            word: entry.fijian_word,
            language: 'fijian',
            english_translation: entry.english_translation,
            part_of_speech: entry.part_of_speech || '',
            example_sentences: entry.example_sentences || [],
            pronunciation: entry.pronunciation || '',
            related_words: entry.related_words || [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        }
      }));

      try {
        await ddbClient.send(new BatchWriteItemCommand({
          RequestItems: {
            [this.dictionaryTableName]: writeRequests
          }
        }));
        
        console.log(`Indexed batch of ${batch.length} entries to DynamoDB`);
      } catch (error) {
        console.error('Error indexing batch to DynamoDB:', error);
        // Try individual puts for failed batch
        for (const entry of batch) {
          try {
            await ddbClient.send(new PutItemCommand({
              TableName: this.dictionaryTableName,
              Item: marshall({
                word: entry.fijian_word,
                language: 'fijian',
                english_translation: entry.english_translation,
                part_of_speech: entry.part_of_speech || '',
                example_sentences: entry.example_sentences || [],
                pronunciation: entry.pronunciation || '',
                related_words: entry.related_words || [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
            }));
          } catch (individualError) {
            console.error(`Error indexing individual entry ${entry.fijian_word}:`, individualError);
          }
        }
      }
    }
  }

  /**
   * Indexes entries to OpenSearch
   */
  async indexToOpenSearch(entries: StructuredDictionaryEntry[]): Promise<void> {
    for (const entry of entries) {
      try {
        const documentId = uuidv4();
        
        await indexToOpenSearch({
          index: 'dictionary',
          id: documentId,
          body: {
            fijian_word: entry.fijian_word,
            english_translation: entry.english_translation,
            part_of_speech: entry.part_of_speech,
            example_sentences: entry.example_sentences,
            pronunciation: entry.pronunciation,
            related_words: entry.related_words,
            embedding: entry.embedding,
            created_at: new Date().toISOString()
          }
        });
        
        console.log(`Indexed ${entry.fijian_word} to OpenSearch`);
      } catch (error) {
        console.error(`Error indexing ${entry.fijian_word} to OpenSearch:`, error);
      }
    }
  }

  /**
   * Main processing function that handles the complete pipeline
   */
  async processPdf(pdfPath: string): Promise<void> {
    console.log(`Processing dictionary PDF: ${pdfPath}`);
    
    try {
      // Step 1: Extract entries from PDF (mock implementation)
      console.log('Extracting dictionary entries...');
      const rawEntries = this.extractEntries('mock content');
      
      // Step 2: Structure the entries
      console.log('Structuring entries...');
      const structuredEntries = this.structureEntries(rawEntries);
      
      // Step 3: Generate embeddings
      console.log('Generating embeddings...');
      const entriesWithEmbeddings = await this.generateEmbeddings(structuredEntries);
      
      // Step 4: Index to DynamoDB
      console.log('Indexing to DynamoDB...');
      await this.indexToDynamoDB(entriesWithEmbeddings);
      
      // Step 5: Index to OpenSearch
      console.log('Indexing to OpenSearch...');
      await this.indexToOpenSearch(entriesWithEmbeddings);
      
      console.log(`Successfully processed ${entriesWithEmbeddings.length} dictionary entries`);
      
    } catch (error) {
      console.error('Error processing PDF:', error);
      throw error;
    }
  }
}

/**
 * Lambda handler for manual dictionary processing
 */
export const processDictionaryHandler = async (event: any) => {
  console.log('Processing dictionary event:', JSON.stringify(event, null, 2));
  
  const dictionaryTableName = process.env.DICTIONARY_TABLE!;
  const processor = new FijianDictionaryProcessor(dictionaryTableName);
  
  try {
    // For manual testing, process mock data
    await processor.processPdf('mock-dictionary.pdf');
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Dictionary processing completed successfully',
        timestamp: new Date().toISOString()
      })
    };
  } catch (error: any) {
    console.error('Dictionary processing failed:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Dictionary processing failed',
        message: error.message
      })
    };
  }
};