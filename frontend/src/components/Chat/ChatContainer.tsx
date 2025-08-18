import React from 'react';
import { useChat } from '../../hooks/useChat';
import { useChatMode } from '../../contexts/ChatModeContext';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ModeSelector from './ModeSelector';
import LanguageToggle from './LanguageToggle';
import ErrorMessage from '../common/ErrorMessage';

const ChatContainer: React.FC = () => {
  const {
    messages,
    inputValue,
    setInputValue,
    sendMessage,
    clearChat,
    isLoading,
    error,
    messagesEndRef,
    streamingChunks,
    isStreamingActive,
  } = useChat();

  const { mode } = useChatMode();

  const handleSend = () => {
    sendMessage(inputValue);
  };

  const handleClearChat = () => {
    clearChat();
  };

  const getModeDescription = () => {
    switch (mode) {
      case 'translation':
        return 'Bidirectional Fijian-English translation';
      case 'learning':
        return 'Grammar explanations and cultural context';
      case 'conversation':
        return 'Natural bilingual conversation with AI assistance';
      default:
        return 'Practice Fijian conversation with AI assistance';
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--color-background)'
    }}>
      {/* Chat header with mode selector */}
      <div style={{
        padding: 'var(--spacing-md)',
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface-elevated)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: 'var(--font-size-lg)',
              color: 'var(--color-text-primary)'
            }}>
              Fijian AI Chat
            </h2>
            <p style={{ 
              margin: 0, 
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)'
            }}>
              {getModeDescription()}
            </p>
          </div>
          
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="button button-secondary"
              style={{
                fontSize: 'var(--font-size-sm)',
                padding: 'var(--spacing-xs) var(--spacing-sm)'
              }}
            >
              Clear Chat
            </button>
          )}
        </div>

        {/* Mode and language controls */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 'var(--spacing-md)',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <ModeSelector />
          <LanguageToggle />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div style={{ padding: 'var(--spacing-md)' }}>
          <ErrorMessage 
            error={error} 
            onRetry={() => {
              // Retry the last message if available
              if (messages.length > 0) {
                const lastUserMessage = messages
                  .slice()
                  .reverse()
                  .find(msg => msg.role === 'user');
                if (lastUserMessage) {
                  sendMessage(lastUserMessage.content);
                }
              }
            }}
          />
        </div>
      )}

      {/* Messages area */}
      <MessageList 
        messages={messages}
        isLoading={isLoading}
        messagesEndRef={messagesEndRef}
        streamingChunks={streamingChunks}
        isStreamingActive={isStreamingActive}
      />

      {/* Input area */}
      <MessageInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        disabled={isLoading}
        mode={mode}
      />
    </div>
  );
};

export default ChatContainer;