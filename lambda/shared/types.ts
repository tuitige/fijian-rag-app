export interface ParagraphTranslation {
  originalText: string;
  translatedText: string;
  originalLanguage: string;
  verified: boolean;
  paragraphId: string;
  atomicPhrases: AtomicPhrase[];
  vocabulary: VocabularyItem[];
}

export interface AtomicPhrase {
  fijian: string;
  english: string;
}

export interface VocabularyItem {
  word: string;
  type: string;     // e.g., noun, verb
  meaning: string;
}
