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
  // Enhanced metadata
  entryNumber?: number;
  etymology?: string;
  contextualNotes?: string;
  regionalVariations?: string;
  crossReferences?: string[];
  usageExamples?: string[];
  culturalContext?: string;
  technicalNotes?: string;
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
  private etymologyPatterns: RegExp[];
  private numberedEntryPattern: RegExp;

  constructor() {
    // Initialize patterns for identifying dictionary entries
    this.entryPatterns = [
      // Pattern 1: Numbered entries with etymology "koko 2. (Eng.) n. definition"
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*(\d+)\.\s*(?:\(([^)]+)\))?\s*([nv]\.)?\s*(.+)$/,
      
      // Pattern 2: Simple numbered entries "koko 2. definition" 
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*(\d+)\.\s*(.+)$/,
      
      // Pattern 3: "word (etymology) pos. definition" format  
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*\(([^)]+)\)\s*([nv]\.)?\s*(.+)$/,
      
      // Pattern 4: "word pos. definition" format
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*([nv]\.)?\s*(.+)$/,
      
      // Pattern 5: "word - definition" format
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*[-–—]\s*(.+)$/,
      
      // Pattern 6: "word. definition" format
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\.\s*(.+)$/,
      
      // Pattern 7: "word: definition" format
      /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+):\s*(.+)$/
    ];

    // Pattern for numbered entries
    this.numberedEntryPattern = /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s+(\d+)\./;

    // Patterns for etymology markers
    this.etymologyPatterns = [
      /\(Eng\.\)/i,  // English derived
      /\(Lau\)/i,    // Lau dialect
      /\(Bau\)/i,    // Bau dialect
      /\(Fij\.\)/i,  // Fijian origin
      /\(archaic\)/i // Archaic usage
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
      { pattern: /FIJIAN\s*[–-]\s*ENGLISH\s*DICTIONARY.*$/i, replacement: '' }, // Remove header
      { pattern: /^\d+$/, replacement: '' }, // Remove standalone page numbers
    ];
  }

  /**
   * Parse text into dictionary entries with enhanced content extraction
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
    let contextualContent: string[] = [];
    let currentContextType: 'definition' | 'usage' | 'cultural' | 'example' = 'definition';
    
    for (const line of lines) {
      const cleanedLine = this.cleanLine(line.text);
      
      if (!cleanedLine || this.isHeaderOrPageNumber(cleanedLine)) continue;

      // Try to match as a new dictionary entry
      const entryMatch = this.matchDictionaryEntry(cleanedLine);
      
      if (entryMatch) {
        // Save previous entry if exists
        if (currentEntry) {
          const finalEntry = this.finalizeEntryWithContent(currentEntry, contextualContent);
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
          entryNumber: entryMatch.entryNumber,
          etymology: entryMatch.etymology,
          sourceText: cleanedLine,
          confidence: entryMatch.confidence,
          pageNumber: this.extractPageNumber(rawText) || 1,
          lineNumbers: [line.lineNumber],
          parsingNotes: entryMatch.notes
        };
        
        contextualContent = [];
        currentContextType = 'definition';
        
      } else if (currentEntry) {
        // This line continues the current entry
        const contentType = this.classifyContentLine(cleanedLine);
        
        if (contentType) {
          contextualContent.push(cleanedLine);
          currentEntry.lineNumbers?.push(line.lineNumber);
          
          // Classify and store different types of content
          switch (contentType) {
            case 'example':
              if (!currentEntry.examples) currentEntry.examples = [];
              currentEntry.examples.push(this.cleanExample(cleanedLine));
              break;
              
            case 'pronunciation':
              currentEntry.pronunciation = this.extractPronunciation(cleanedLine);
              break;
              
            case 'cultural':
              currentEntry.culturalContext = (currentEntry.culturalContext || '') + ' ' + cleanedLine;
              break;
              
            case 'technical':
              currentEntry.technicalNotes = (currentEntry.technicalNotes || '') + ' ' + cleanedLine;
              break;
              
            case 'regional':
              currentEntry.regionalVariations = (currentEntry.regionalVariations || '') + ' ' + cleanedLine;
              break;
              
            case 'cross_reference':
              if (!currentEntry.crossReferences) currentEntry.crossReferences = [];
              currentEntry.crossReferences.push(...this.extractCrossReferences(cleanedLine));
              break;
              
            case 'continuation':
            default:
              // Add to contextual notes
              currentEntry.contextualNotes = (currentEntry.contextualNotes || '') + ' ' + cleanedLine;
              break;
          }
        }
        
      } else {
        // Line doesn't match any pattern and we're not in an entry
        if (cleanedLine.length > 10) { // Only log substantial unmatched lines
          stats.errors.push(`Unmatched line ${line.lineNumber}: "${cleanedLine.substring(0, 50)}..."`);
        }
      }
    }

    // Finalize last entry
    if (currentEntry) {
      const finalEntry = this.finalizeEntryWithContent(currentEntry, contextualContent);
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
    entryNumber?: number;
    etymology?: string;
    confidence: number;
    notes: string[];
  } | null {
    
    const notes: string[] = [];
    let confidence = 50; // Base confidence
    
    // Pattern 1: Numbered entries with etymology "koko 2. (Eng.) n. definition"
    let match = line.match(/^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*(\d+)\.\s*(?:\(([^)]+)\))?\s*([nv]\.)?\s*(.+)$/);
    if (match) {
      const headword = match[1].trim();
      const entryNumber = parseInt(match[2]);
      const etymology = match[3] ? match[3].trim() : undefined;
      const partOfSpeech = match[4] ? this.expandPartOfSpeech(match[4]) : undefined;
      const definition = match[5].trim();
      
      confidence = 95;
      notes.push('Numbered entry with full metadata');
      if (etymology) notes.push(`Etymology: ${etymology}`);
      if (partOfSpeech) notes.push(`Part of speech: ${partOfSpeech}`);
      
      return {
        headword,
        definition,
        partOfSpeech,
        entryNumber,
        etymology,
        confidence,
        notes
      };
    }
    
    // Pattern 2: Simple numbered entries "koko 2. definition"
    match = line.match(/^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*(\d+)\.\s*(.+)$/);
    if (match) {
      const headword = match[1].trim();
      const entryNumber = parseInt(match[2]);
      const definition = match[3].trim();
      
      confidence = 85;
      notes.push('Numbered entry');
      
      return {
        headword,
        definition,
        entryNumber,
        confidence,
        notes
      };
    }
    
    // Pattern 3: "word (etymology) pos. definition"
    match = line.match(/^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*\(([^)]+)\)\s*([nv]\.)?\s*(.+)$/);
    if (match) {
      const headword = match[1].trim();
      const etymology = match[2].trim();
      const partOfSpeech = match[3] ? this.expandPartOfSpeech(match[3]) : undefined;
      const definition = match[4].trim();
      
      confidence = 90;
      notes.push('Entry with etymology');
      if (partOfSpeech) notes.push(`Part of speech: ${partOfSpeech}`);
      
      return {
        headword,
        definition,
        partOfSpeech,
        etymology,
        confidence,
        notes
      };
    }
    
    // Pattern 4: "word pos. definition"
    match = line.match(/^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*([nv]\.)?\s*(.+)$/);
    if (match && match[2]) { // Only if POS is present
      const headword = match[1].trim();
      const partOfSpeech = this.expandPartOfSpeech(match[2]);
      const definition = match[3].trim();
      
      confidence = 80;
      notes.push(`Part of speech: ${partOfSpeech}`);
      
      return {
        headword,
        definition,
        partOfSpeech,
        confidence,
        notes
      };
    }
    
    // Pattern 5: "word - definition"
    match = line.match(/^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*[-–—]\s*(.+)$/);
    if (match) {
      const headword = match[1].trim();
      const definition = match[2].trim();
      
      confidence = 75;
      notes.push('Dash-separated entry');
      
      return {
        headword,
        definition,
        confidence,
        notes
      };
    }
    
    // Pattern 6: "word. definition"
    match = line.match(/^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\.\s*(.+)$/);
    if (match) {
      const headword = match[1].trim();
      const definition = match[2].trim();
      
      confidence = 70;
      notes.push('Period-separated entry');
      
      return {
        headword,
        definition,
        confidence,
        notes
      };
    }
    
    // Pattern 7: "word: definition"
    match = line.match(/^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+):\s*(.+)$/);
    if (match) {
      const headword = match[1].trim();
      const definition = match[2].trim();
      
      confidence = 75;
      notes.push('Colon-separated entry');
      
      return {
        headword,
        definition,
        confidence,
        notes
      };
    }
    
    return null;
  }

  /**
   * Expand abbreviated part of speech
   */
  private expandPartOfSpeech(abbrev: string): string {
    const expansions: { [key: string]: string } = {
      'n.': 'noun',
      'v.': 'verb',
      'adj.': 'adjective',
      'adv.': 'adverb',
      'prep.': 'preposition',
      'conj.': 'conjunction',
      'int.': 'interjection',
      'pron.': 'pronoun'
    };
    
    return expansions[abbrev.toLowerCase()] || abbrev;
  }

  /**
   * Check if line is header or page number that should be ignored
   */
  private isHeaderOrPageNumber(line: string): boolean {
    return /^FIJIAN\s*[–-]\s*ENGLISH\s*DICTIONARY/i.test(line) ||
           /^R\.\s*GATTY$/i.test(line) ||
           /^\d+$/.test(line) ||
           /^Page\s+\d+/i.test(line) ||
           /^---\s*PAGE\s+\d+\s*---/i.test(line);
  }

  /**
   * Extract page number from text
   */
  private extractPageNumber(text: string): number | null {
    const pageMatch = text.match(/---\s*PAGE\s+(\d+)\s*---/i) || 
                     text.match(/Page\s+(\d+)/i) ||
                     text.match(/^\s*(\d+)\s*$/m);
    return pageMatch ? parseInt(pageMatch[1]) : null;
  }

  /**
   * Classify content line type
   */
  private classifyContentLine(line: string): 'example' | 'pronunciation' | 'cultural' | 'technical' | 'regional' | 'cross_reference' | 'continuation' | null {
    const lowerLine = line.toLowerCase();
    
    // Example sentences - often contain specific patterns
    if (this.isExampleSentence(line)) {
      return 'example';
    }
    
    // Pronunciation information
    if (this.isPronunciationNote(line)) {
      return 'pronunciation';
    }
    
    // Cultural context indicators
    if (lowerLine.includes('traditional') || lowerLine.includes('custom') || 
        lowerLine.includes('ceremony') || lowerLine.includes('ritual') ||
        lowerLine.includes('cultural') || lowerLine.includes('ancient') ||
        lowerLine.includes('folklore') || lowerLine.includes('legend')) {
      return 'cultural';
    }
    
    // Technical/specialized usage
    if (lowerLine.includes('technical') || lowerLine.includes('medical') ||
        lowerLine.includes('botanical') || lowerLine.includes('scientific') ||
        lowerLine.includes('legal') || lowerLine.includes('formal')) {
      return 'technical';
    }
    
    // Regional variations
    if (lowerLine.includes('region') || lowerLine.includes('island') ||
        lowerLine.includes('dialect') || lowerLine.includes('area') ||
        lowerLine.includes('province') || /\b(bau|lau|rewa|tailevu)\b/i.test(line)) {
      return 'regional';
    }
    
    // Cross-references
    if (lowerLine.includes('see also') || lowerLine.includes('cf.') ||
        lowerLine.includes('compare') || lowerLine.includes('syn.') ||
        lowerLine.includes('synonym') || lowerLine.includes('related:')) {
      return 'cross_reference';
    }
    
    // Default to continuation
    return 'continuation';
  }

  /**
   * Extract cross-references from a line
   */
  private extractCrossReferences(line: string): string[] {
    const refs: string[] = [];
    
    // Look for "see also X" patterns
    const seeAlsoMatch = line.match(/see also\s+([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s,]+)/i);
    if (seeAlsoMatch) {
      refs.push(...seeAlsoMatch[1].split(',').map(s => s.trim()));
    }
    
    // Look for "syn. X" patterns
    const synMatch = line.match(/syn\.\s+([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s,]+)/i);
    if (synMatch) {
      refs.push(...synMatch[1].split(',').map(s => s.trim()));
    }
    
    return refs.filter(ref => ref.length > 0);
  }

  /**
   * Clean example sentence
   */
  private cleanExample(line: string): string {
    // Remove common example markers
    return line.replace(/^(example|e\.g\.|eg\.)\s*:?\s*/i, '')
               .replace(/^\s*[-•*]\s*/, '')
               .trim();
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
   * Finalize entry with contextual content
   */
  private finalizeEntryWithContent(entry: Partial<ParsedEntry>, contextualContent: string[]): ParsedEntry | null {
    if (!entry.fijian || !entry.english) {
      return null;
    }

    // Merge contextual content intelligently
    if (contextualContent.length > 0) {
      const additionalContent = contextualContent.join(' ').trim();
      
      // If the main definition is short, append contextual content
      if (entry.english && entry.english.length < 100) {
        entry.english += ' ' + additionalContent;
      } else {
        // Store as contextual notes if definition is already substantial
        entry.contextualNotes = (entry.contextualNotes || '') + ' ' + additionalContent;
      }
      
      entry.parsingNotes?.push(`Contextual content from ${contextualContent.length} additional lines`);
    }

    // Clean up all text fields
    entry.english = entry.english?.replace(/\s+/g, ' ').trim();
    entry.contextualNotes = entry.contextualNotes?.replace(/\s+/g, ' ').trim();
    entry.culturalContext = entry.culturalContext?.replace(/\s+/g, ' ').trim();
    entry.technicalNotes = entry.technicalNotes?.replace(/\s+/g, ' ').trim();
    entry.regionalVariations = entry.regionalVariations?.replace(/\s+/g, ' ').trim();

    // Remove empty fields
    if (entry.contextualNotes === '') entry.contextualNotes = undefined;
    if (entry.culturalContext === '') entry.culturalContext = undefined;
    if (entry.technicalNotes === '') entry.technicalNotes = undefined;
    if (entry.regionalVariations === '') entry.regionalVariations = undefined;

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