/**
 * Dictionary Entry Parser
 * 
 * Parses extracted text to identify and structure Fijian dictionary entries
 * Handles various formatting patterns and OCR inconsistencies
 */

import { DictionaryEntry } from './processor';

export interface ParsedEntry extends DictionaryEntry {
  sourceText: string;
  confidence: number;
  pageNumber: number;
  lineNumbers: number[];
  parsingNotes: string[];
}

export interface ParsingStats {
  totalLines: number;
  entriesFound: number;
  malformedEntries: number;
  confidenceDistribution: {
    high: number; // >90%
    medium: number; // 70-90%
    low: number; // <70%
  };
  commonPatterns: string[];
  errors: string[];
}

export class DictionaryParser {
  private entryPatterns: RegExp[];
  private cleaningPatterns: Array<{ pattern: RegExp; replacement: string }>;

  constructor() {
    // Initialize patterns for identifying dictionary entries
    this.entryPatterns = [
      // Pattern 1: "word - definition" format
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*[-–—]\s*(.+)$/,
      
      // Pattern 2: "word (pos) definition" format  
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*\(([^)]+)\)\s*(.+)$/,
      
      // Pattern 3: "word. definition" format
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\.\s*(.+)$/,
      
      // Pattern 4: "word: definition" format
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+):\s*(.+)$/,
      
      // Pattern 5: Bold or numbered entries
      /^(?:\d+\.\s*)?([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s+(.+)$/
    ];

    // Patterns for cleaning OCR artifacts and formatting
    this.cleaningPatterns = [
      { pattern: /\s+/g, replacement: ' ' }, // Multiple spaces
      { pattern: /[""]/g, replacement: '"' }, // Smart quotes
      { pattern: /['']/g, replacement: "'" }, // Smart apostrophes
      { pattern: /…/g, replacement: '...' }, // Ellipsis
      { pattern: /\b[Il]\b/g, replacement: '1' }, // OCR 1/l/I confusion in numbers
      { pattern: /\b[O0]\b/g, replacement: 'O' }, // OCR O/0 confusion in words
      { pattern: /^\s*[|†*•]\s*/, replacement: '' }, // Remove bullet points and artifacts
      { pattern: /\s*\[\?\]\s*/g, replacement: ' ' }, // Remove OCR uncertainty markers
    ];
  }

  /**
   * Parse text into dictionary entries
   */
  async parseText(rawText: string, filename: string): Promise<{
    entries: ParsedEntry[];
    stats: ParsingStats;
  }> {
    console.log(`Parsing dictionary entries from ${filename}...`);
    
    const lines = rawText.split('\n').map((line, index) => ({
      text: line.trim(),
      lineNumber: index + 1
    })).filter(line => line.text.length > 0);

    const entries: ParsedEntry[] = [];
    const stats: ParsingStats = {
      totalLines: lines.length,
      entriesFound: 0,
      malformedEntries: 0,
      confidenceDistribution: { high: 0, medium: 0, low: 0 },
      commonPatterns: [],
      errors: []
    };

    let currentEntry: Partial<ParsedEntry> | null = null;
    let continuationLines: string[] = [];
    
    for (const line of lines) {
      const cleanedLine = this.cleanLine(line.text);
      
      if (!cleanedLine) continue;

      // Try to match as a new dictionary entry
      const entryMatch = this.matchDictionaryEntry(cleanedLine);
      
      if (entryMatch) {
        // Save previous entry if exists
        if (currentEntry) {
          const finalEntry = this.finalizeEntry(currentEntry, continuationLines);
          if (finalEntry) {
            entries.push(finalEntry);
            stats.entriesFound++;
          } else {
            stats.malformedEntries++;
          }
        }

        // Start new entry
        currentEntry = {
          fijian: entryMatch.headword,
          english: entryMatch.definition,
          pos: entryMatch.partOfSpeech,
          sourceText: cleanedLine,
          confidence: entryMatch.confidence,
          pageNumber: 1, // Would need page detection for multi-page docs
          lineNumbers: [line.lineNumber],
          parsingNotes: entryMatch.notes
        };
        
        continuationLines = [];
        
      } else if (currentEntry && this.isDefinitionContinuation(cleanedLine)) {
        // This line continues the previous entry
        continuationLines.push(cleanedLine);
        currentEntry.lineNumbers?.push(line.lineNumber);
        
      } else if (this.isExampleSentence(cleanedLine)) {
        // This line is an example sentence
        if (currentEntry) {
          if (!currentEntry.examples) currentEntry.examples = [];
          currentEntry.examples.push(cleanedLine);
          currentEntry.lineNumbers?.push(line.lineNumber);
        }
        
      } else if (this.isPronunciationNote(cleanedLine)) {
        // This line contains pronunciation information
        if (currentEntry) {
          currentEntry.pronunciation = this.extractPronunciation(cleanedLine);
          currentEntry.lineNumbers?.push(line.lineNumber);
        }
        
      } else {
        // Line doesn't match any pattern
        if (cleanedLine.length > 3) { // Ignore very short lines
          stats.errors.push(`Unmatched line ${line.lineNumber}: "${cleanedLine}"`);
        }
      }
    }

    // Finalize last entry
    if (currentEntry) {
      const finalEntry = this.finalizeEntry(currentEntry, continuationLines);
      if (finalEntry) {
        entries.push(finalEntry);
        stats.entriesFound++;
      } else {
        stats.malformedEntries++;
      }
    }

    // Calculate confidence distribution
    for (const entry of entries) {
      if (entry.confidence >= 90) stats.confidenceDistribution.high++;
      else if (entry.confidence >= 70) stats.confidenceDistribution.medium++;
      else stats.confidenceDistribution.low++;
    }

    // Analyze common patterns
    stats.commonPatterns = this.analyzePatterns(entries);

    console.log(`Parsing completed: ${stats.entriesFound} entries found, ${stats.malformedEntries} malformed`);
    
    return { entries, stats };
  }

  /**
   * Clean line text of OCR artifacts
   */
  private cleanLine(text: string): string {
    let cleaned = text;
    
    for (const { pattern, replacement } of this.cleaningPatterns) {
      cleaned = cleaned.replace(pattern, replacement);
    }
    
    return cleaned.trim();
  }

  /**
   * Try to match a line as a dictionary entry
   */
  private matchDictionaryEntry(line: string): {
    headword: string;
    definition: string;
    partOfSpeech?: string;
    confidence: number;
    notes: string[];
  } | null {
    
    const notes: string[] = [];
    let confidence = 50; // Base confidence
    
    for (let i = 0; i < this.entryPatterns.length; i++) {
      const pattern = this.entryPatterns[i];
      const match = line.match(pattern);
      
      if (match) {
        let headword = match[1].trim();
        let definition = '';
        let partOfSpeech: string | undefined;
        
        // Different handling based on pattern type
        switch (i) {
          case 0: // "word - definition"
            definition = match[2].trim();
            confidence = 85;
            break;
            
          case 1: // "word (pos) definition"
            partOfSpeech = match[2].trim();
            definition = match[3].trim();
            confidence = 95;
            notes.push('Part of speech identified');
            break;
            
          case 2: // "word. definition"
            definition = match[2].trim();
            confidence = 75;
            break;
            
          case 3: // "word: definition"
            definition = match[2].trim();
            confidence = 80;
            break;
            
          case 4: // Numbered or bold entries
            definition = match[2].trim();
            confidence = 70;
            notes.push('Numbered or formatted entry');
            break;
        }

        // Validate headword (should be a reasonable Fijian word)
        if (this.isValidFijianWord(headword)) {
          confidence += 10;
        } else {
          confidence -= 20;
          notes.push('Questionable headword format');
        }

        // Validate definition length
        if (definition.length < 3) {
          confidence -= 30;
          notes.push('Very short definition');
        } else if (definition.length > 200) {
          confidence -= 10;
          notes.push('Very long definition, may include extra content');
        }

        return {
          headword,
          definition,
          partOfSpeech,
          confidence: Math.max(0, Math.min(100, confidence)),
          notes
        };
      }
    }
    
    return null;
  }

  /**
   * Check if line continues a definition
   */
  private isDefinitionContinuation(line: string): boolean {
    // Lines that start with lowercase or certain punctuation likely continue definitions
    return /^[a-z,;.]/.test(line) || line.startsWith('or ') || line.startsWith('also ');
  }

  /**
   * Check if line is an example sentence
   */
  private isExampleSentence(line: string): boolean {
    // Look for patterns indicating examples
    return line.includes(' - ') && (line.toLowerCase().includes('example') || 
           /[A-Z][a-z]+ .+ - [A-Z][a-z]+/.test(line));
  }

  /**
   * Check if line contains pronunciation
   */
  private isPronunciationNote(line: string): boolean {
    return line.includes('[') && line.includes(']') || 
           line.toLowerCase().includes('pronounced') ||
           /\([^)]*pronunciation[^)]*\)/i.test(line);
  }

  /**
   * Extract pronunciation from line
   */
  private extractPronunciation(line: string): string {
    const bracketMatch = line.match(/\[([^\]]+)\]/);
    if (bracketMatch) return bracketMatch[1];
    
    const parenMatch = line.match(/\(([^)]*pronunciation[^)]*)\)/i);
    if (parenMatch) return parenMatch[1];
    
    return line;
  }

  /**
   * Validate if string looks like a Fijian word
   */
  private isValidFijianWord(word: string): boolean {
    // Basic validation for Fijian phonology
    // Fijian typically uses: a, e, i, o, u, b, c, d, f, g, j, k, l, m, n, p, q, r, s, t, v, w, y
    const fijianPattern = /^[abcdefgijklmnpqrstuvwy]+$/i;
    
    return word.length >= 2 && 
           word.length <= 20 && 
           fijianPattern.test(word) &&
           /[aeiou]/i.test(word); // Must contain at least one vowel
  }

  /**
   * Finalize entry with continuation lines
   */
  private finalizeEntry(entry: Partial<ParsedEntry>, continuationLines: string[]): ParsedEntry | null {
    if (!entry.fijian || !entry.english) {
      return null;
    }

    // Merge continuation lines into definition
    if (continuationLines.length > 0) {
      entry.english += ' ' + continuationLines.join(' ');
      entry.parsingNotes?.push(`Definition continued over ${continuationLines.length} lines`);
    }

    // Clean up final definition
    entry.english = entry.english.replace(/\s+/g, ' ').trim();

    return entry as ParsedEntry;
  }

  /**
   * Analyze common patterns in parsed entries
   */
  private analyzePatterns(entries: ParsedEntry[]): string[] {
    const patterns: string[] = [];
    
    const posCount = entries.filter(e => e.pos).length;
    if (posCount > 0) {
      patterns.push(`${posCount} entries with part-of-speech tags`);
    }
    
    const exampleCount = entries.filter(e => e.examples && e.examples.length > 0).length;
    if (exampleCount > 0) {
      patterns.push(`${exampleCount} entries with examples`);
    }
    
    const pronunciationCount = entries.filter(e => e.pronunciation).length;
    if (pronunciationCount > 0) {
      patterns.push(`${pronunciationCount} entries with pronunciation`);
    }

    return patterns;
  }
}