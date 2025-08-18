import { ChatMode, TranslationDirection, LearningExplanation } from './llm';

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  mode?: ChatMode;
  metadata?: {
    translatedText?: string;
    originalText?: string;
    explanation?: LearningExplanation;
    confidence?: number;
    alternatives?: string[];
    hints?: string[];
  };
}

export interface ChatResponse {
  message: string;
  mode?: ChatMode;
  direction?: TranslationDirection;
  translatedText?: string;
  explanation?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ChatRequest {
  input?: string; // For backward compatibility
  message?: string;
  mode?: ChatMode;
  direction?: TranslationDirection;
  context?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  userId?: string;
}

export interface ChatHistoryResponse {
  userId: string;
  history: ChatHistoryItem[];
  total: number;
}

export interface ChatHistoryItem {
  timestamp: number;
  message: string;
  response: string;
  createdAt: string;
}