import React from 'react';
import { Message } from '../../types/chat';
import { StreamChunk } from '../../types/llm';
import MessageItem from './MessageItem';
import StreamingMessage from './StreamingMessage';
import LoadingSpinner from '../common/LoadingSpinner';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  streamingChunks?: StreamChunk[];
  isStreamingActive?: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isLoading, 
  messagesEndRef,
  streamingChunks = [],
  isStreamingActive = false
}) => {
  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--spacing-md) 0',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {messages.length === 0 && !isStreamingActive ? (
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
              Choose a mode and start a conversation to learn Fijian language
            </p>
          </div>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
          
          {/* Streaming message display */}
          {isStreamingActive && streamingChunks.length > 0 && (
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
                maxWidth: '80%',
                wordWrap: 'break-word' as const
              }}>
                <StreamingMessage 
                  chunks={streamingChunks}
                  isComplete={false}
                />
              </div>
            </div>
          )}
          
          {/* Loading indicator for non-streaming requests */}
          {isLoading && !isStreamingActive && (
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
                  AI is thinking...
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