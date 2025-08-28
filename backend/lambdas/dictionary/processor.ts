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
import { PDFExtractor, ExtractionResult } from './pdf-extractor';
import { DictionaryParser, ParsedEntry, ParsingStats } from './dictionary-parser';
import { OutputFormatter, OutputMetadata } from './output-formatter';

const ddbClient = new DynamoDBClient({});

export interface DictionaryEntry {
  fijian: string;
  english: string;
  pos?: string; // part of speech
  examples?: string[];
  pronunciation?: string;
  related?: string[];
  // Enhanced metadata for complex dictionary entries
  entryNumber?: number; // For numbered variants like "koko 2."
  etymology?: string; // e.g., "(Eng.)", "(Lau)"
  contextualNotes?: string; // Extended usage and cultural context
  regionalVariations?: string; // Regional usage information
  crossReferences?: string[]; // References to other entries
  usageExamples?: string[]; // Examples in context
  culturalContext?: string; // Cultural and historical background
  technicalNotes?: string; // Specialized usage notes
}

export interface StructuredDictionaryEntry {
  fijian_word: string;
  english_translation: string;
  part_of_speech?: string;
  example_sentences?: string[];
  pronunciation?: string;
  related_words?: string[];
  embedding?: number[];
  // Enhanced metadata for parsed entries
  confidence_score?: number;
  source_text?: string;
  page_number?: number;
  parsing_notes?: string[];
  // Complex dictionary metadata
  entry_number?: number;
  etymology?: string;
  contextual_notes?: string;
  regional_variations?: string;
  cross_references?: string[];
  usage_examples?: string[];
  cultural_context?: string;
  technical_notes?: string;
}

export class FijianDictionaryProcessor {
  private dictionaryTableName: string;
  private bucketName: string;
  private pdfExtractor: PDFExtractor;
  private parser: DictionaryParser;
  private outputFormatter: OutputFormatter;
  
  constructor(dictionaryTableName: string, bucketName?: string) {
    this.dictionaryTableName = dictionaryTableName;
    this.bucketName = bucketName || process.env.CONTENT_BUCKET_NAME || 'fijian-rag-content';
    this.pdfExtractor = new PDFExtractor(this.bucketName);
    this.parser = new DictionaryParser();
    this.outputFormatter = new OutputFormatter(this.bucketName);
  }

  /**
   * Extract entries from processed text using enhanced PDF parsing
   */
  async extractEntries(pdfPath: string): Promise<{
    entries: ParsedEntry[];
    stats: ParsingStats;
    extractionResult: ExtractionResult;
    outputMetadata: {
      jsonl: OutputMetadata;
      csv: OutputMetadata;
      summary: string;
    };
  }> {
    console.log(`Starting enhanced PDF extraction for: ${pdfPath}`);
    
    try {
      // Step 1: Extract text from PDF using Textract
      const extractionResult = await this.pdfExtractor.extractFromPDF(pdfPath);
      
      if (extractionResult.errors.length > 0) {
        console.warn(`PDF extraction completed with ${extractionResult.errors.length} errors`);
        extractionResult.errors.forEach(error => console.warn(`  - ${error}`));
      }
      
      // Step 2: Parse the extracted text into dictionary entries
      const { entries, stats } = await this.parser.parseText(
        extractionResult.rawText, 
        extractionResult.metadata.filename
      );
      
      // Step 3: Export entries as JSONL and CSV
      const sourceFilename = extractionResult.metadata.filename.replace(/\.pdf$/i, '');
      
      const jsonlMetadata = await this.outputFormatter.exportAsJSONL(
        entries, 
        stats, 
        sourceFilename
      );
      
      const csvMetadata = await this.outputFormatter.exportAsCSV(
        entries, 
        stats, 
        sourceFilename
      );
      
      const summaryKey = await this.outputFormatter.exportProcessingSummary(
        entries,
        stats,
        sourceFilename,
        extractionResult.metadata
      );
      
      console.log(`PDF processing completed successfully:`);
      console.log(`  - Extracted ${entries.length} dictionary entries`);
      console.log(`  - Average confidence: ${stats.entriesFound > 0 ? 
        (entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length).toFixed(1) : 0}%`);
      console.log(`  - Malformed entries: ${stats.malformedEntries}`);
      console.log(`  - JSONL export: ${jsonlMetadata.s3Key}`);
      console.log(`  - CSV export: ${csvMetadata.s3Key}`);
      console.log(`  - Summary report: ${summaryKey}`);
      
      return {
        entries,
        stats,
        extractionResult,
        outputMetadata: {
          jsonl: jsonlMetadata,
          csv: csvMetadata,
          summary: summaryKey
        }
      };
      
    } catch (error) {
      console.error(`Enhanced PDF extraction failed for ${pdfPath}:`, error);
      throw error;
    }
  }

  /**
   * Process PDF from S3 location
   */
  async extractEntriesFromS3(s3Key: string): Promise<{
    entries: ParsedEntry[];
    stats: ParsingStats;
    extractionResult: ExtractionResult;
    outputMetadata: {
      jsonl: OutputMetadata;
      csv: OutputMetadata;
      summary: string;
    };
  }> {
    console.log(`Processing PDF from S3: ${s3Key}`);
    
    try {
      // Step 1: Extract text from S3-stored PDF
      const extractionResult = await this.pdfExtractor.extractFromS3(s3Key);
      
      // Step 2: Parse the extracted text
      const { entries, stats } = await this.parser.parseText(
        extractionResult.rawText, 
        extractionResult.metadata.filename
      );
      
      // Step 3: Export results
      const sourceFilename = extractionResult.metadata.filename.replace(/\.pdf$/i, '');
      
      const jsonlMetadata = await this.outputFormatter.exportAsJSONL(
        entries, 
        stats, 
        sourceFilename
      );
      
      const csvMetadata = await this.outputFormatter.exportAsCSV(
        entries, 
        stats, 
        sourceFilename
      );
      
      const summaryKey = await this.outputFormatter.exportProcessingSummary(
        entries,
        stats,
        sourceFilename,
        extractionResult.metadata
      );
      
      return {
        entries,
        stats,
        extractionResult,
        outputMetadata: {
          jsonl: jsonlMetadata,
          csv: csvMetadata,
          summary: summaryKey
        }
      };
      
    } catch (error) {
      console.error(`S3 PDF processing failed for ${s3Key}:`, error);
      throw error;
    }
  }

  /**
   * Legacy method - extracts dictionary entries from processed text (deprecated)
   * @deprecated Use extractEntries() for full PDF processing pipeline
   */
  extractEntriesLegacy(textContent: string): DictionaryEntry[] {
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
   * Structures dictionary entries for storage (handles both legacy and new formats)
   */
  structureEntries(entries: DictionaryEntry[] | ParsedEntry[]): StructuredDictionaryEntry[] {
    return entries.map(entry => {
      // Handle both legacy DictionaryEntry and new ParsedEntry formats
      const isParsedEntry = 'sourceText' in entry;
      
      return {
        fijian_word: entry.fijian,
        english_translation: entry.english,
        part_of_speech: entry.pos,
        example_sentences: entry.examples,
        pronunciation: entry.pronunciation,
        related_words: entry.related,
        // Add metadata for parsed entries
        ...(isParsedEntry && {
          confidence_score: (entry as ParsedEntry).confidence,
          source_text: (entry as ParsedEntry).sourceText,
          page_number: (entry as ParsedEntry).pageNumber,
          parsing_notes: (entry as ParsedEntry).parsingNotes
        })
      };
    });
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
   * Main processing function that handles the complete PDF pipeline
   */
  async processPdf(pdfPath: string): Promise<{
    entriesProcessed: number;
    outputFiles: {
      jsonl: string;
      csv: string;
      summary: string;
    };
    extractionStats: ParsingStats;
  }> {
    console.log(`Processing dictionary PDF with enhanced pipeline: ${pdfPath}`);
    
    try {
      // Step 1: Extract and parse entries from PDF
      console.log('Extracting dictionary entries from PDF...');
      const extractionResults = await this.extractEntries(pdfPath);
      
      // Step 2: Structure the entries for storage
      console.log('Structuring entries for database storage...');
      const structuredEntries = this.structureEntries(extractionResults.entries);
      
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
      console.log(`Extraction confidence: ${extractionResults.extractionResult.confidence.toFixed(1)}%`);
      console.log(`Parsing success rate: ${((extractionResults.stats.entriesFound / (extractionResults.stats.entriesFound + extractionResults.stats.malformedEntries)) * 100).toFixed(1)}%`);
      
      return {
        entriesProcessed: entriesWithEmbeddings.length,
        outputFiles: {
          jsonl: extractionResults.outputMetadata.jsonl.s3Key,
          csv: extractionResults.outputMetadata.csv.s3Key,
          summary: extractionResults.outputMetadata.summary
        },
        extractionStats: extractionResults.stats
      };
      
    } catch (error) {
      console.error('Error processing PDF:', error);
      throw error;
    }
  }

  /**
   * Process PDF from S3 location
   */
  async processPdfFromS3(s3Key: string): Promise<{
    entriesProcessed: number;
    outputFiles: {
      jsonl: string;
      csv: string;
      summary: string;
    };
    extractionStats: ParsingStats;
  }> {
    console.log(`Processing dictionary PDF from S3: ${s3Key}`);
    
    try {
      // Step 1: Extract and parse entries from S3 PDF
      const extractionResults = await this.extractEntriesFromS3(s3Key);
      
      // Step 2: Structure the entries
      const structuredEntries = this.structureEntries(extractionResults.entries);
      
      // Step 3: Generate embeddings
      const entriesWithEmbeddings = await this.generateEmbeddings(structuredEntries);
      
      // Step 4: Index to DynamoDB
      await this.indexToDynamoDB(entriesWithEmbeddings);
      
      // Step 5: Index to OpenSearch
      await this.indexToOpenSearch(entriesWithEmbeddings);
      
      return {
        entriesProcessed: entriesWithEmbeddings.length,
        outputFiles: {
          jsonl: extractionResults.outputMetadata.jsonl.s3Key,
          csv: extractionResults.outputMetadata.csv.s3Key,
          summary: extractionResults.outputMetadata.summary
        },
        extractionStats: extractionResults.stats
      };
      
    } catch (error) {
      console.error('Error processing S3 PDF:', error);
      throw error;
    }
  }

  /**
   * Process sample dictionary data for testing and demonstration
   */
  async processSampleData(): Promise<void> {
    console.log('Processing sample dictionary data...');
    
    try {
      // Import sample data
      const { SAMPLE_DICTIONARY_ENTRIES } = await import('./sample-data');
      
      // Step 1: Use sample entries directly (no PDF extraction needed)
      console.log('Using sample dictionary entries...');
      const rawEntries = SAMPLE_DICTIONARY_ENTRIES;
      
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
      
      console.log(`Successfully processed ${entriesWithEmbeddings.length} sample dictionary entries`);
      
    } catch (error) {
      console.error('Error processing sample data:', error);
      throw error;
    }
  }
}

/**
 * Lambda handler for manual dictionary processing
 * Can be triggered via API Gateway to populate dictionary with sample data
 * or process PDFs from S3 events
 */
export const processDictionaryHandler = async (event: any) => {
  console.log('Processing dictionary event:', JSON.stringify(event, null, 2));
  
  const dictionaryTableName = process.env.DICTIONARY_TABLE!;
  const bucketName = process.env.CONTENT_BUCKET_NAME;
  const processor = new FijianDictionaryProcessor(dictionaryTableName, bucketName);
  
  try {
    // Check if this is an S3 event (PDF upload)
    if (event.Records && event.Records[0]?.eventSource === 'aws:s3') {
      return await handleS3Event(event, processor);
    }
    
    // Check if this is an API Gateway event or direct Lambda invoke
    const isApiGateway = event.httpMethod && event.path;
    
    if (isApiGateway) {
      return await handleApiGatewayEvent(event, processor);
    }
    
    // Direct Lambda invocation - check for PDF processing request
    if (event.action === 'process_pdf' && event.s3Key) {
      return await handleDirectPdfProcessing(event, processor);
    }
    
    // Default: process sample data
    await processor.processSampleData();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Dictionary processing completed successfully',
        timestamp: new Date().toISOString(),
        source: 'sample-data'
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

/**
 * Handle S3 event (PDF uploaded)
 */
async function handleS3Event(event: any, processor: FijianDictionaryProcessor) {
  const record = event.Records[0];
  const bucketName = record.s3.bucket.name;
  const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  
  console.log(`Processing PDF from S3: s3://${bucketName}/${objectKey}`);
  
  // Only process PDF files
  if (!objectKey.toLowerCase().endsWith('.pdf')) {
    console.log('Skipping non-PDF file:', objectKey);
    return { statusCode: 200, body: 'File skipped - not a PDF' };
  }
  
  // Skip files not in the expected directory
  if (!objectKey.includes('dictionary') && !objectKey.includes('pdf')) {
    console.log('Skipping file outside dictionary processing scope:', objectKey);
    return { statusCode: 200, body: 'File skipped - outside processing scope' };
  }
  
  try {
    const result = await processor.processPdfFromS3(objectKey);
    
    console.log(`S3 PDF processing completed: ${result.entriesProcessed} entries processed`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'PDF processing completed successfully',
        entriesProcessed: result.entriesProcessed,
        outputFiles: result.outputFiles,
        extractionStats: result.extractionStats,
        sourceFile: objectKey,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error: any) {
    console.error(`S3 PDF processing failed for ${objectKey}:`, error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'S3 PDF processing failed',
        message: error.message,
        sourceFile: objectKey
      })
    };
  }
}

/**
 * Handle API Gateway event
 */
async function handleApiGatewayEvent(event: any, processor: FijianDictionaryProcessor) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: ''
    };
  }
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  // Parse request body
  let requestBody: any = {};
  if (event.body) {
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }
  }
  
  // Check if this is a PDF processing request
  if (requestBody.action === 'process_pdf' && requestBody.s3Key) {
    try {
      const result = await processor.processPdfFromS3(requestBody.s3Key);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          message: 'PDF processing completed successfully',
          entriesProcessed: result.entriesProcessed,
          outputFiles: result.outputFiles,
          extractionStats: result.extractionStats,
          sourceFile: requestBody.s3Key,
          timestamp: new Date().toISOString()
        })
      };
      
    } catch (error: any) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'PDF processing failed',
          message: error.message,
          sourceFile: requestBody.s3Key
        })
      };
    }
  }
  
  // Default: process sample data
  await processor.processSampleData();
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      message: 'Dictionary processing completed successfully',
      timestamp: new Date().toISOString(),
      source: 'sample-data'
    })
  };
}

/**
 * Handle direct PDF processing invocation
 */
async function handleDirectPdfProcessing(event: any, processor: FijianDictionaryProcessor) {
  try {
    const result = await processor.processPdfFromS3(event.s3Key);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'PDF processing completed successfully',
        entriesProcessed: result.entriesProcessed,
        outputFiles: result.outputFiles,
        extractionStats: result.extractionStats,
        sourceFile: event.s3Key,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'PDF processing failed',
        message: error.message,
        sourceFile: event.s3Key
      })
    };
  }
}