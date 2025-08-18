import api from './api';
import { StreamingClient, StreamCallback, StreamCompleteCallback } from './streamingClient';
import { 
  ChatRequest, 
  ChatResponseData, 
  StreamChunk,
  ChatMode,
  TranslationDirection 
} from '../types/llm';

export class LLMService {
  private static streamingClient = new StreamingClient();

  /**
   * Send a chat message with LLM-specific features
   * @param request - The chat request with mode and other parameters
   * @returns Promise<ChatResponseData> - The response data
   */
  static async sendMessage(request: ChatRequest): Promise<ChatResponseData> {
    try {
      const response = await api.post<ChatResponseData>('/chat', request);
      return response.data;
    } catch (error) {
      console.error('Error sending LLM message:', error);
      throw error;
    }
  }

  /**
   * Send a streaming chat message
   * @param request - The chat request
   * @param onChunk - Callback for each stream chunk
   * @param onComplete - Callback when streaming is complete
   * @param onError - Callback for errors
   */
  static async sendStreamingMessage(
    request: ChatRequest,
    onChunk: StreamCallback,
    onComplete: StreamCompleteCallback,
    onError?: (error: Error) => void
  ): Promise<void> {
    const streamRequest = { ...request, stream: true };
    
    try {
      // Use POST streaming for the chat endpoint
      await this.streamingClient.startStreamPost(
        '/api/chat/stream',
        streamRequest,
        onChunk,
        onComplete,
        onError
      );
    } catch (error) {
      console.error('Error starting stream:', error);
      if (onError) {
        onError(error as Error);
      }
    }
  }

  /**
   * Stop current streaming session
   */
  static stopStreaming(): void {
    this.streamingClient.stopStream();
  }

  /**
   * Check if currently streaming
   */
  static isStreaming(): boolean {
    return this.streamingClient.isStreaming();
  }

  /**
   * Create a chat request with proper system prompts based on mode
   * @param message - User message
   * @param mode - Chat mode
   * @param direction - Translation direction (for translation mode)
   * @param context - Previous messages for context
   * @returns ChatRequest object
   */
  static createChatRequest(
    message: string,
    mode: ChatMode,
    direction?: TranslationDirection,
    context?: Array<{ role: 'user' | 'assistant'; content: string; }>
  ): ChatRequest {
    return {
      message,
      mode,
      direction,
      context: context?.slice(-10), // Keep last 10 messages for context
    };
  }

  /**
   * Get system prompt for a specific mode
   * @param mode - The chat mode
   * @param direction - Translation direction (for translation mode)
   * @returns System prompt string
   */
  static getSystemPrompt(mode: ChatMode, direction?: TranslationDirection): string {
    switch (mode) {
      case 'translation':
        const directionText = direction === 'fj-en' ? 'from Fijian to English' :
                             direction === 'en-fj' ? 'from English to Fijian' :
                             'automatically detecting the language and translating appropriately';
        
        return `You are a professional Fijian-English translator. Your task is to provide accurate translations ${directionText}. 
        
For each translation:
1. Provide the main translation
2. Include confidence level (0-1)
3. Suggest alternative translations when appropriate
4. Preserve cultural context and meaning
5. Handle both formal and colloquial expressions

Response format should include the translated text, confidence score, and any alternatives.`;

      case 'learning':
        return `You are a Fijian language teacher and cultural expert. Your role is to help learners understand Fijian language, grammar, and culture.

For each query:
1. Break down grammar structures in simple terms
2. Explain cultural context when relevant
3. Provide usage examples
4. Include pronunciation guidance when helpful
5. Suggest related vocabulary
6. Be encouraging and educational

Focus on making Fijian language accessible and culturally respectful.`;

      case 'conversation':
        return `You are a bilingual conversational partner fluent in both Fijian and English. You help users practice natural conversation in both languages.

Conversation guidelines:
1. Support code-switching (mixing languages naturally)
2. Provide gentle corrections without interrupting flow
3. Offer grammar hints inline when helpful
4. Maintain context across the conversation
5. Be culturally appropriate and respectful
6. Encourage natural language use

Respond naturally and help build confidence in both languages.`;

      default:
        return 'You are a helpful assistant that can communicate in both Fijian and English.';
    }
  }

  /**
   * Parse streaming response into appropriate format based on mode
   * @param chunks - Array of stream chunks
   * @param mode - Chat mode
   * @returns Parsed response data
   */
  static parseStreamingResponse(chunks: StreamChunk[], mode: ChatMode): Partial<ChatResponseData> {
    const fullContent = chunks.map(chunk => chunk.content).join('');
    const lastChunk = chunks[chunks.length - 1];
    
    const baseResponse: Partial<ChatResponseData> = {
      message: fullContent,
      mode,
      confidence: lastChunk?.metadata?.confidence,
      alternatives: lastChunk?.metadata?.alternatives
    };

    // Mode-specific parsing could be enhanced here
    // For now, return the base response
    return baseResponse;
  }

  /**
   * Validate chat request
   * @param request - Chat request to validate
   * @returns boolean indicating if request is valid
   */
  static validateRequest(request: ChatRequest): boolean {
    if (!request.message || typeof request.message !== 'string' || request.message.trim().length === 0) {
      return false;
    }

    if (!['translation', 'learning', 'conversation'].includes(request.mode)) {
      return false;
    }

    if (request.direction && !['fj-en', 'en-fj', 'auto'].includes(request.direction)) {
      return false;
    }

    return true;
  }
}