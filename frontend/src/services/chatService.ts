import api from './api';
import { 
  ChatRequest, 
  ChatResponse, 
  ChatHistoryResponse,
  ChatHistoryItem 
} from '../types/chat';
import { LearningModulesResponse } from '../types/api';
import { ChatMode, TranslationDirection } from '../types/llm';

export class ChatService {
  /**
   * Send a chat message to the backend with enhanced features
   */
  static async sendMessage(
    input: string, 
    mode: ChatMode = 'conversation',
    direction?: TranslationDirection,
    context?: Array<{role: 'user' | 'assistant'; content: string;}>,
    userId?: string
  ): Promise<ChatResponse> {
    const payload: ChatRequest = { 
      message: input, 
      input, // Keep for backward compatibility
      mode,
      direction,
      context,
      userId
    };
    const response = await api.post<ChatResponse>('/chat', payload);
    return response.data;
  }

  /**
   * Send a chat message to the backend (legacy support)
   */
  static async sendSimpleMessage(input: string): Promise<ChatResponse> {
    const payload: ChatRequest = { input };
    const response = await api.post<ChatResponse>('/chat', payload);
    return response.data;
  }

  /**
   * Get chat history for a user
   */
  static async getChatHistory(userId: string, limit: number = 10): Promise<ChatHistoryItem[]> {
    const response = await api.get<ChatHistoryResponse>('/chat/history', {
      params: { userId, limit }
    });
    return response.data.history;
  }

  /**
   * Get available learning modules
   */
  static async getLearningModules(): Promise<LearningModulesResponse> {
    const response = await api.get<LearningModulesResponse>('/learn');
    return response.data;
  }

  /**
   * Retry failed request with exponential backoff
   */
  static async retryRequest<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(lastError!.message);
  }
}