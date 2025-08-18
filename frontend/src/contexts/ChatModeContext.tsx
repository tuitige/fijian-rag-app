import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ChatMode, TranslationDirection } from '../types/llm';

interface ChatModeContextType {
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  direction: TranslationDirection;
  setDirection: (direction: TranslationDirection) => void;
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
}

const ChatModeContext = createContext<ChatModeContextType | undefined>(undefined);

interface ChatModeProviderProps {
  children: ReactNode;
}

export const ChatModeProvider: React.FC<ChatModeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ChatMode>('conversation');
  const [direction, setDirection] = useState<TranslationDirection>('auto');
  const [isStreaming, setIsStreaming] = useState(true);

  const value: ChatModeContextType = {
    mode,
    setMode,
    direction,
    setDirection,
    isStreaming,
    setIsStreaming,
  };

  return (
    <ChatModeContext.Provider value={value}>
      {children}
    </ChatModeContext.Provider>
  );
};

export const useChatMode = (): ChatModeContextType => {
  const context = useContext(ChatModeContext);
  if (context === undefined) {
    throw new Error('useChatMode must be used within a ChatModeProvider');
  }
  return context;
};