import { useState, useCallback, useRef, useEffect } from 'react';
import { Message } from '../types/chat';
import { ChatService } from '../services/chatService';
import { useApi } from './useApi';

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const sendMessageApi = useApi<any>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Add a message to the chat
  const addMessage = useCallback((content: string, role: 'user' | 'assistant') => {
    const newMessage: Message = {
      id: generateMessageId(),
      content,
      role,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, [generateMessageId]);

  // Send a message
  const sendMessage = useCallback(async (input: string) => {
    if (!input.trim()) return;

    // Add user message immediately
    addMessage(input, 'user');
    setInputValue('');

    try {
      // Send to backend with retry logic
      const response = await sendMessageApi.execute(() => 
        ChatService.retryRequest(() => ChatService.sendMessage(input))
      );

      // Add assistant response
      const responseText = typeof response === 'string' ? response : 
                          (response as any)?.message || 'Sorry, I could not process your message.';
      addMessage(responseText, 'assistant');
    } catch (error) {
      console.error('Error sending message:', error);
      addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
    }
  }, [addMessage, sendMessageApi]);

  // Clear chat history
  const clearChat = useCallback(() => {
    setMessages([]);
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

  return {
    messages,
    inputValue,
    setInputValue,
    sendMessage,
    clearChat,
    loadHistory,
    isLoading: sendMessageApi.loading,
    error: sendMessageApi.error,
    messagesEndRef,
  };
}