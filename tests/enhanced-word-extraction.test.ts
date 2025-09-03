/**
 * Test cases for enhanced word extraction and RAG improvements
 */

import { extractFijianWords } from '../backend/lambdas/chat/src/rag-service';

describe('Enhanced Word Extraction', () => {
  describe('Question Pattern Recognition', () => {
    test('should prioritize target word in "what does X mean" questions', () => {
      const result = extractFijianWords("Bula, what does veivuke mean?");
      
      // Should prioritize 'veivuke' as first word
      expect(result[0]).toBe('veivuke');
      expect(result).toContain('veivuke');
      expect(result).toContain('bula');
      
      // Should not include function words like 'what', 'does', 'mean'
      expect(result).not.toContain('what');
      expect(result).not.toContain('does');
      expect(result).not.toContain('mean');
    });

    test('should handle "what is X" pattern', () => {
      const result = extractFijianWords("What is tamata?");
      
      expect(result[0]).toBe('tamata');
      expect(result).not.toContain('what');
      expect(result).not.toContain('is');
    });

    test('should handle "meaning of X" pattern', () => {
      const result = extractFijianWords("What is the meaning of veivuke?");
      
      expect(result[0]).toBe('veivuke');
      expect(result).not.toContain('meaning');
      expect(result).not.toContain('the');
    });
  });

  describe('Function Word Filtering', () => {
    test('should deprioritize common Fijian function words', () => {
      const result = extractFijianWords("vica na tamata tiko i Savusavu?");
      
      // Should prioritize content words
      expect(result).toContain('vica');
      expect(result).toContain('tamata');
      expect(result).toContain('savusavu');
      
      // Function words should come later or be excluded
      const contentWordIndices = [
        result.indexOf('vica'),
        result.indexOf('tamata'),
        result.indexOf('savusavu')
      ].filter(i => i !== -1);
      
      const functionWordIndices = [
        result.indexOf('na'),
        result.indexOf('tiko'),
        result.indexOf('i')
      ].filter(i => i !== -1);
      
      // Content words should appear before function words
      if (contentWordIndices.length > 0 && functionWordIndices.length > 0) {
        expect(Math.min(...contentWordIndices)).toBeLessThan(Math.min(...functionWordIndices));
      }
    });

    test('should filter out English function words', () => {
      const result = extractFijianWords("How do you say hello in Fijian?");
      
      expect(result).not.toContain('how');
      expect(result).not.toContain('do');
      expect(result).not.toContain('you');
      expect(result).not.toContain('in');
      expect(result).toContain('hello');
      expect(result).toContain('fijian');
    });
  });

  describe('Word Limit and Quality', () => {
    test('should limit results to maximum 5 words', () => {
      const longQuery = "This is a very long sentence with many words that should be filtered and limited properly to avoid too many lookups";
      const result = extractFijianWords(longQuery);
      
      expect(result.length).toBeLessThanOrEqual(5);
    });

    test('should maintain word length requirements', () => {
      const result = extractFijianWords("a very short word test i o");
      
      // Should filter out 1-letter words
      expect(result).not.toContain('a');
      expect(result).not.toContain('i');
      expect(result).not.toContain('o');
      
      // Should keep valid words
      expect(result).toContain('very');
      expect(result).toContain('short');
      expect(result).toContain('word');
      expect(result).toContain('test');
    });

    test('should filter out non-alphabetic characters', () => {
      const result = extractFijianWords("hello123 test@domain.com good-word");
      
      expect(result).not.toContain('hello123');
      expect(result).not.toContain('test@domain.com');
      expect(result).not.toContain('good-word');
      expect(result).toContain('good');
      expect(result).toContain('word');
    });
  });

  describe('Real-world Test Cases', () => {
    test('should handle the veivuke example correctly', () => {
      const result = extractFijianWords("Bula, what does veivuke mean?");
      
      // Primary expectation: veivuke should be first
      expect(result[0]).toBe('veivuke');
      
      // Secondary: should include bula
      expect(result).toContain('bula');
      
      // Should not include question words
      expect(result).not.toContain('what');
      expect(result).not.toContain('does');
      expect(result).not.toContain('mean');
      
      console.log('Veivuke test result:', result);
    });

    test('should handle the Savusavu example correctly', () => {
      const result = extractFijianWords("vica na tamata tiko i Savusavu?");
      
      // Should include important content words
      expect(result).toContain('vica');
      expect(result).toContain('tamata');
      expect(result).toContain('savusavu');
      
      // Should deprioritize or exclude function words
      const naIndex = result.indexOf('na');
      const tikoIndex = result.indexOf('tiko');
      const iIndex = result.indexOf('i');
      
      // If function words are included, they should come after content words
      const contentWords = ['vica', 'tamata', 'savusavu'];
      const maxContentIndex = Math.max(...contentWords.map(w => result.indexOf(w)).filter(i => i !== -1));
      
      if (naIndex !== -1) {
        expect(naIndex).toBeGreaterThan(maxContentIndex);
      }
      
      console.log('Savusavu test result:', result);
    });
  });
});