export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export interface ChatResponse {
  message: string;
  translatedText?: string;
  explanation?: string;
}

export interface ChatRequest {
  input: string;
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