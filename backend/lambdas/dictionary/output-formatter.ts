/**
 * Output Formatter
 * 
 * Formats parsed dictionary entries into JSONL and CSV formats
 * Handles chunking and normalization for downstream processing
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ParsedEntry, ParsingStats } from './dictionary-parser';

const s3Client = new S3Client({});

export interface OutputMetadata {
  filename: string;
  format: 'jsonl' | 'csv';
  entryCount: number;
  generatedAt: string;
  s3Key: string;
  sourceFile: string;
  processingStats: ParsingStats;
}

export interface NormalizedEntry {
  id: string;
  headword: string;
  definition: string;
  part_of_speech: string | null;
  examples: string[];
  pronunciation: string | null;
  related_words: string[];
  confidence_score: number;
  // Enhanced metadata
  entry_number?: number;
  etymology?: string;
  contextual_notes?: string;
  regional_variations?: string;
  cross_references?: string[];
  usage_examples?: string[];
  cultural_context?: string;
  technical_notes?: string;
  source_metadata: {
    original_text: string;
    page_number: number;
    line_numbers: number[];
    parsing_notes: string[];
  };
}

export class OutputFormatter {
  private bucketName: string;
  private s3Prefix: string;

  constructor(bucketName: string, s3Prefix: string = 'dictionary-processing/outputs/') {
    this.bucketName = bucketName;
    this.s3Prefix = s3Prefix;
  }

  /**
   * Export entries as JSONL format (one JSON object per line)
   */
  async exportAsJSONL(
    entries: ParsedEntry[],
    stats: ParsingStats,
    sourceFilename: string
  ): Promise<OutputMetadata> {
    console.log(`Exporting ${entries.length} entries as JSONL...`);
    
    const normalizedEntries = this.normalizeEntries(entries);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFilename = `${sourceFilename}-entries-${timestamp}.jsonl`;
    const s3Key = `${this.s3Prefix}jsonl/${outputFilename}`;
    
    // Create JSONL content (one JSON object per line)
    const jsonlLines = normalizedEntries.map(entry => JSON.stringify(entry));
    const jsonlContent = jsonlLines.join('\n');
    
    // Store in S3
    await this.storeInS3(s3Key, jsonlContent, 'application/jsonlines');
    
    const metadata: OutputMetadata = {
      filename: outputFilename,
      format: 'jsonl',
      entryCount: entries.length,
      generatedAt: new Date().toISOString(),
      s3Key,
      sourceFile: sourceFilename,
      processingStats: stats
    };
    
    // Store metadata separately
    const metadataKey = `${this.s3Prefix}metadata/${outputFilename}.metadata.json`;
    await this.storeInS3(metadataKey, JSON.stringify(metadata, null, 2), 'application/json');
    
    console.log(`JSONL export completed: ${s3Key}`);
    return metadata;
  }

  /**
   * Export entries as CSV format
   */
  async exportAsCSV(
    entries: ParsedEntry[],
    stats: ParsingStats,
    sourceFilename: string
  ): Promise<OutputMetadata> {
    console.log(`Exporting ${entries.length} entries as CSV...`);
    
    const normalizedEntries = this.normalizeEntries(entries);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFilename = `${sourceFilename}-entries-${timestamp}.csv`;
    const s3Key = `${this.s3Prefix}csv/${outputFilename}`;
    
    // Create CSV content
    const csvContent = this.createCSVContent(normalizedEntries);
    
    // Store in S3
    await this.storeInS3(s3Key, csvContent, 'text/csv');
    
    const metadata: OutputMetadata = {
      filename: outputFilename,
      format: 'csv',
      entryCount: entries.length,
      generatedAt: new Date().toISOString(),
      s3Key,
      sourceFile: sourceFilename,
      processingStats: stats
    };
    
    // Store metadata
    const metadataKey = `${this.s3Prefix}metadata/${outputFilename}.metadata.json`;
    await this.storeInS3(metadataKey, JSON.stringify(metadata, null, 2), 'application/json');
    
    console.log(`CSV export completed: ${s3Key}`);
    return metadata;
  }

  /**
   * Export processing summary report
   */
  async exportProcessingSummary(
    entries: ParsedEntry[],
    stats: ParsingStats,
    sourceFilename: string,
    extractionMetadata: any
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const summaryFilename = `${sourceFilename}-processing-summary-${timestamp}.json`;
    const s3Key = `${this.s3Prefix}summaries/${summaryFilename}`;
    
    const summary = {
      processing_metadata: {
        source_file: sourceFilename,
        processed_at: new Date().toISOString(),
        total_entries_extracted: entries.length,
        extraction_method: extractionMetadata?.method || 'unknown'
      },
      extraction_stats: extractionMetadata,
      parsing_stats: stats,
      quality_metrics: this.calculateQualityMetrics(entries, stats),
      sample_entries: entries.slice(0, 5).map(entry => ({
        headword: entry.fijian,
        definition: entry.english.substring(0, 100) + (entry.english.length > 100 ? '...' : ''),
        confidence: entry.confidence,
        has_examples: (entry.examples?.length || 0) > 0,
        has_pronunciation: !!entry.pronunciation
      })),
      recommendations: this.generateRecommendations(entries, stats)
    };
    
    await this.storeInS3(s3Key, JSON.stringify(summary, null, 2), 'application/json');
    
    console.log(`Processing summary exported: ${s3Key}`);
    return s3Key;
  }

  /**
   * Normalize parsed entries to consistent format
   */
  private normalizeEntries(entries: ParsedEntry[]): NormalizedEntry[] {
    return entries.map((entry, index) => ({
      id: `entry_${index + 1}_${entry.fijian.toLowerCase().replace(/[^a-z0-9]/g, '_')}${entry.entryNumber ? `_${entry.entryNumber}` : ''}`,
      headword: entry.fijian.trim(),
      definition: this.cleanDefinition(entry.english),
      part_of_speech: entry.pos || null,
      examples: this.normalizeExamples(entry.examples || []),
      pronunciation: entry.pronunciation || null,
      related_words: entry.related || [],
      confidence_score: Math.round(entry.confidence * 100) / 100, // Round to 2 decimal places
      // Enhanced metadata
      entry_number: entry.entryNumber,
      etymology: entry.etymology,
      contextual_notes: entry.contextualNotes ? this.cleanText(entry.contextualNotes) : undefined,
      regional_variations: entry.regionalVariations ? this.cleanText(entry.regionalVariations) : undefined,
      cross_references: entry.crossReferences || [],
      usage_examples: entry.usageExamples || [],
      cultural_context: entry.culturalContext ? this.cleanText(entry.culturalContext) : undefined,
      technical_notes: entry.technicalNotes ? this.cleanText(entry.technicalNotes) : undefined,
      source_metadata: {
        original_text: entry.sourceText,
        page_number: entry.pageNumber,
        line_numbers: entry.lineNumbers,
        parsing_notes: entry.parsingNotes
      }
    }));
  }

  /**
   * Clean and normalize definition text
   */
  private cleanDefinition(definition: string): string {
    return definition
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^[;,.\s]+/, '') // Remove leading punctuation
      .replace(/[;,.\s]+$/, '') // Remove trailing punctuation
      .trim();
  }

  /**
   * Clean and normalize general text
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Normalize example sentences
   */
  private normalizeExamples(examples: string[]): string[] {
    return examples
      .map(example => example.trim())
      .filter(example => example.length > 0)
      .map(example => {
        // Remove example markers if present
        return example.replace(/^(e\.g\.?|ex\.?|example:?)\s*/i, '').trim();
      });
  }

  /**
   * Create CSV content with proper escaping
   */
  private createCSVContent(entries: NormalizedEntry[]): string {
    const headers = [
      'id',
      'headword',
      'definition',
      'part_of_speech',
      'examples',
      'pronunciation',
      'related_words',
      'confidence_score',
      'entry_number',
      'etymology',
      'contextual_notes',
      'regional_variations',
      'cross_references',
      'usage_examples',
      'cultural_context',
      'technical_notes',
      'original_text',
      'page_number',
      'line_numbers',
      'parsing_notes'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const entry of entries) {
      const row = [
        this.escapeCsvValue(entry.id),
        this.escapeCsvValue(entry.headword),
        this.escapeCsvValue(entry.definition),
        this.escapeCsvValue(entry.part_of_speech || ''),
        this.escapeCsvValue(entry.examples.join('; ')),
        this.escapeCsvValue(entry.pronunciation || ''),
        this.escapeCsvValue(entry.related_words.join('; ')),
        entry.confidence_score.toString(),
        entry.entry_number?.toString() || '',
        this.escapeCsvValue(entry.etymology || ''),
        this.escapeCsvValue(entry.contextual_notes || ''),
        this.escapeCsvValue(entry.regional_variations || ''),
        this.escapeCsvValue(entry.cross_references?.join('; ') || ''),
        this.escapeCsvValue(entry.usage_examples?.join('; ') || ''),
        this.escapeCsvValue(entry.cultural_context || ''),
        this.escapeCsvValue(entry.technical_notes || ''),
        this.escapeCsvValue(entry.source_metadata.original_text),
        entry.source_metadata.page_number.toString(),
        this.escapeCsvValue(entry.source_metadata.line_numbers.join('; ')),
        this.escapeCsvValue(entry.source_metadata.parsing_notes.join('; '))
      ];
      
      csvRows.push(row.join(','));
    }
    
    return csvRows.join('\n');
  }
  /**
   * Escape CSV values with quotes and handle commas/quotes
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  /**
   * Calculate quality metrics
   */
  private calculateQualityMetrics(entries: ParsedEntry[], stats: ParsingStats) {
    const avgConfidence = entries.length > 0 
      ? entries.reduce((sum, entry) => sum + entry.confidence, 0) / entries.length 
      : 0;
    
    const withExamples = entries.filter(e => e.examples && e.examples.length > 0).length;
    const withPronunciation = entries.filter(e => e.pronunciation).length;
    const withPOS = entries.filter(e => e.pos).length;
    
    return {
      average_confidence: Math.round(avgConfidence * 100) / 100,
      entries_with_examples: withExamples,
      entries_with_pronunciation: withPronunciation,
      entries_with_part_of_speech: withPOS,
      completeness_score: Math.round(((withExamples + withPronunciation + withPOS) / (entries.length * 3)) * 100),
      error_rate: Math.round((stats.malformedEntries / (stats.entriesFound + stats.malformedEntries)) * 100)
    };
  }

  /**
   * Generate processing recommendations
   */
  private generateRecommendations(entries: ParsedEntry[], stats: ParsingStats): string[] {
    const recommendations: string[] = [];
    
    const avgConfidence = entries.length > 0 
      ? entries.reduce((sum, entry) => sum + entry.confidence, 0) / entries.length 
      : 0;
    
    if (avgConfidence < 70) {
      recommendations.push('Consider manual review due to low average confidence score');
    }
    
    if (stats.malformedEntries > stats.entriesFound * 0.1) {
      recommendations.push('High number of malformed entries detected - consider preprocessing PDF');
    }
    
    const lowConfidenceEntries = entries.filter(e => e.confidence < 60).length;
    if (lowConfidenceEntries > 0) {
      recommendations.push(`${lowConfidenceEntries} entries have very low confidence - manual verification recommended`);
    }
    
    const incompleteEntries = entries.filter(e => !e.examples && !e.pronunciation && !e.pos).length;
    if (incompleteEntries > entries.length * 0.5) {
      recommendations.push('Many entries lack additional metadata (examples, pronunciation, POS) - consider enhanced parsing rules');
    }
    
    if (stats.errors.length > 10) {
      recommendations.push('High number of parsing errors - consider refining extraction patterns');
    }
    
    return recommendations;
  }

  /**
   * Store data in S3
   */
  private async storeInS3(key: string, content: string, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: content,
      ContentType: contentType,
      Metadata: {
        'processing-timestamp': new Date().toISOString(),
        'source': 'fijian-dictionary-processor',
        'format': contentType.includes('jsonlines') ? 'jsonl' : contentType.includes('csv') ? 'csv' : 'json'
      }
    });

    await s3Client.send(command);
  }
}