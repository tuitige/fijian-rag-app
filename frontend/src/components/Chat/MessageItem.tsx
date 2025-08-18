import React from 'react';
import { Message } from '../../types/chat';

interface MessageItemProps {
  message: Message;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 'var(--spacing-md)',
      padding: '0 var(--spacing-md)'
    }}>
      <div style={{
        maxWidth: '70%',
        minWidth: '120px'
      }}>
        <div style={{
          backgroundColor: isUser ? 'var(--color-primary)' : 'var(--color-surface)',
          color: isUser ? 'white' : 'var(--color-text-primary)',
          padding: 'var(--spacing-sm) var(--spacing-md)',
          borderRadius: 'var(--border-radius-lg)',
          border: isUser ? 'none' : '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          wordWrap: 'break-word' as const
        }}>
          {message.content}
        </div>
        
        <div style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)',
          marginTop: 'var(--spacing-xs)',
          textAlign: isUser ? 'right' : 'left' as const
        }}>
          {message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;