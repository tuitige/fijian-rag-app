import React from 'react';
import { Message } from '../../types/chat';
import MessageItem from './MessageItem';
import LoadingSpinner from '../common/LoadingSpinner';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isLoading, 
  messagesEndRef 
}) => {
  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--spacing-md) 0',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {messages.length === 0 ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center' as const,
          color: 'var(--color-text-muted)',
          padding: 'var(--spacing-2xl)'
        }}>
          <div>
            <div style={{ 
              fontSize: 'var(--font-size-2xl)',
              marginBottom: 'var(--spacing-md)'
            }}>
              👋
            </div>
            <h3 style={{ marginBottom: 'var(--spacing-sm)' }}>
              Welcome to Fijian AI Chat!
            </h3>
            <p style={{ margin: 0 }}>
              Start a conversation to learn Fijian language
            </p>
          </div>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
          
          {isLoading && (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-start',
              marginBottom: 'var(--spacing-md)',
              padding: '0 var(--spacing-md)'
            }}>
              <div style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderRadius: 'var(--border-radius-lg)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)'
              }}>
                <LoadingSpinner size="sm" />
                <span style={{ 
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--font-size-sm)'
                }}>
                  AI is typing...
                </span>
              </div>
            </div>
          )}
        </>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;