/**
 * Extract short phrases from a list of paragraphs.
 * Filters out overly long or short segments and trims whitespace.
 */
export const extractShortPhrases = (paragraphs: string[]): string[] => {
    const MIN_LENGTH = 10;
    const MAX_LENGTH = 150;
  
    const phrases: string[] = [];
  
    for (const paragraph of paragraphs) {
      if (typeof paragraph !== 'string') continue; // ✅ Skip bad input
  
      const segments = paragraph
        .split(/[.!?;\n]/)
        .map(s => s?.trim())
        .filter(s => s && s.length >= MIN_LENGTH && s.length <= MAX_LENGTH);
  
      phrases.push(...segments);
    }
  
    return phrases;
  };
  