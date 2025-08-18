import React from 'react';
import { useChat } from '../../hooks/useChat';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
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
  } = useChat();

  const handleSend = () => {
    sendMessage(inputValue);
  };

  const handleClearChat = () => {
    clearChat();
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--color-background)'
    }}>
      {/* Chat header with actions */}
      <div style={{
        padding: 'var(--spacing-md)',
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface-elevated)',
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
            Chat Session
          </h2>
          <p style={{ 
            margin: 0, 
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)'
          }}>
            Practice Fijian conversation with AI assistance
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
      />

      {/* Input area */}
      <MessageInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        disabled={isLoading}
      />
    </div>
  );
};

export default ChatContainer;