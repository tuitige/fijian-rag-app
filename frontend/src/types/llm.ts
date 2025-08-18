// LLM-specific types for chat modes, streaming, and translation

export interface StreamChunk {
  content: string;
  isComplete: boolean;
  metadata?: {
    confidence?: number;
    alternatives?: string[];
  };
}

export type ChatMode = 'translation' | 'learning' | 'conversation';
export type TranslationDirection = 'fj-en' | 'en-fj' | 'auto';

export interface ChatRequest {
  message: string;
  mode: ChatMode;
  direction?: TranslationDirection;
  context?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
}

export interface ChatResponseData {
  message: string;
  mode: ChatMode;
  translatedText?: string;
  originalText?: string;
  explanation?: {
    grammar?: string;
    usage?: string;
    cultural?: string;
    vocabulary?: Array<{
      word: string;
      meaning: string;
      pronunciation?: string;
    }>;
  };
  confidence?: number;
  alternatives?: string[];
}

export interface LearningExplanation {
  grammar: string;
  usage: string;
  cultural?: string;
  examples: string[];
  vocabulary: Array<{
    word: string;
    meaning: string;
    pronunciation?: string;
  }>;
}

export interface TranslationResult {
  original: string;
  translated: string;
  direction: TranslationDirection;
  confidence: number;
  alternatives?: string[];
}

export interface ConversationContext {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  language: 'fijian' | 'english' | 'mixed';
}