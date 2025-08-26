import { useState, useCallback, useRef, useEffect } from 'react';
import { Message } from '../types/chat';
import { ChatService } from '../services/chatService';
import { LLMService } from '../services/llmService';
import { useChatMode } from '../contexts/ChatModeContext';
import { useAuth } from '../hooks/useAuth';
import { useProgress } from '../contexts/UserProgressContext';
import { useApi } from './useApi';
import { StreamChunk } from '../types/llm';

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [streamingChunks, setStreamingChunks] = useState<StreamChunk[]>([]);
  const [isStreamingActive, setIsStreamingActive] = useState(false);
  const sendMessageApi = useApi<any>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { mode, direction, isStreaming } = useChatMode();
  const { user, isAuthenticated } = useAuth();
  const { recordChatMessage, recordWordLearned } = useProgress();

  // Auto-scroll to bottom when new messages are added
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Helper function to extract Fijian words from AI responses
  const extractFijianWords = useCallback((text: string): Array<{ word: string; translation: string }> => {
    // Simple regex to find word translations in format "word (translation)" or "word - translation"
    const wordPattern = /([a-zA-Z]+)\s*[(-]\s*([^)\n]+)[)]?/g;
    const words: Array<{ word: string; translation: string }> = [];
    let match;
    
    while ((match = wordPattern.exec(text)) !== null) {
      const word = match[1].trim();
      const translation = match[2].trim();
      
      // Basic validation - word should be reasonable length and translation shouldn't be too long
      if (word.length >= 2 && word.length <= 20 && translation.length <= 50) {
        words.push({ word, translation });
      }
    }
    
    return words;
  }, []);

  // Add a message to the chat
  const addMessage = useCallback((content: string, role: 'user' | 'assistant', metadata?: any) => {
    const newMessage: Message = {
      id: generateMessageId(),
      content,
      role,
      timestamp: new Date(),
      mode,
      metadata
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // Record progress for authenticated users
    if (isAuthenticated && role === 'assistant') {
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage && lastUserMessage.role === 'user') {
        recordChatMessage(lastUserMessage.content, content).catch(console.error);
        
        // Extract and record new words for learning mode
        if (mode === 'learning' && metadata?.explanation) {
          // Simple word extraction - in real app, this would be more sophisticated
          const fijianWords = extractFijianWords(content);
          fijianWords.forEach(({ word, translation }) => {
            recordWordLearned(word, translation).catch(console.error);
          });
        }
      }
    }
    
    return newMessage;
  }, [generateMessageId, mode, isAuthenticated, messages, recordChatMessage, recordWordLearned, extractFijianWords]);

  // Get conversation context for LLM
  const getContext = useCallback(() => {
    return messages.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }, [messages]);

  // Send a message with streaming support
  const sendMessage = useCallback(async (input: string) => {
    if (!input.trim()) return;

    // Add user message immediately
    addMessage(input, 'user');
    setInputValue('');

    try {
      const context = getContext();
      
      if (isStreaming) {
        // Use streaming
        setIsStreamingActive(true);
        setStreamingChunks([]);
        
        const chunks: StreamChunk[] = [];
        
        const request = LLMService.createChatRequest(input, mode, direction, context);
        
        await LLMService.sendStreamingMessage(
          request,
          (chunk: StreamChunk) => {
            chunks.push(chunk);
            setStreamingChunks([...chunks]);
          },
          () => {
            // Streaming complete
            const fullContent = chunks.map(c => c.content).join('');
            const responseData = LLMService.parseStreamingResponse(chunks, mode);
            
            addMessage(fullContent, 'assistant', responseData);
            setIsStreamingActive(false);
            setStreamingChunks([]);
          },
          (error: Error) => {
            console.error('Streaming error:', error);
            setIsStreamingActive(false);
            setStreamingChunks([]);
            addMessage('Sorry, I encountered an error with streaming. Please try again.', 'assistant');
          }
        );
      } else {
        // Use regular request
        const response = await sendMessageApi.execute(() => 
          ChatService.retryRequest(() => 
            ChatService.sendMessage(input, mode, direction, context)
          )
        );

        // Parse response based on mode
        let responseText = '';
        let metadata: any = {};

        if (typeof response === 'string') {
          responseText = response;
        } else if (response && typeof response === 'object') {
          responseText = response.message || response.response || 'Sorry, I could not process your message.';
          
          // Extract metadata based on mode
          if (mode === 'translation') {
            metadata.translatedText = response.message;
            metadata.originalText = input;
            metadata.confidence = response.confidence;
            metadata.alternatives = response.alternatives;
          } else if (mode === 'learning') {
            metadata.explanation = response.explanation;
          }
        } else {
          responseText = 'Sorry, I could not process your message.';
        }

        addMessage(responseText, 'assistant', metadata);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
    }
  }, [addMessage, sendMessageApi, getContext, mode, direction, isStreaming]);

  // Clear chat history
  const clearChat = useCallback(() => {
    setMessages([]);
    setStreamingChunks([]);
    setIsStreamingActive(false);
    LLMService.stopStreaming();
  }, []);

  // Load chat history (for future implementation)
  const loadHistory = useCallback(async (userId: string) => {
    try {
      const history = await ChatService.getChatHistory(userId);
      const historyMessages: Message[] = history.map(item => [
        {
          id: `${item.timestamp}_user`,
          content: item.message,
          role: 'user' as const,
          timestamp: new Date(item.createdAt),
        },
        {
          id: `${item.timestamp}_assistant`,
          content: item.response,
          role: 'assistant' as const,
          timestamp: new Date(item.createdAt),
        }
      ]).flat();
      
      setMessages(historyMessages);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  }, []);

  // Load user's chat history on authentication
  useEffect(() => {
    if (isAuthenticated && user && messages.length === 0) {
      loadHistory(user.id);
    }
  }, [isAuthenticated, user, loadHistory, messages.length]);

  return {
    messages,
    inputValue,
    setInputValue,
    sendMessage,
    clearChat,
    loadHistory,
    isLoading: sendMessageApi.loading || isStreamingActive,
    error: sendMessageApi.error,
    messagesEndRef,
    streamingChunks,
    isStreamingActive,
  };
}