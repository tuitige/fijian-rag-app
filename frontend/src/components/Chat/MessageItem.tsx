import React from 'react';
import { Message } from '../../types/chat';
import { TranslationResult, LearningExplanation } from '../../types/llm';
import TranslationDisplay from '../Features/TranslationDisplay';
import LearningCard from '../Features/LearningCard';
import ContextHints from '../Features/ContextHints';

interface MessageItemProps {
  message: Message;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  // Helper function to render mode-specific content
  const renderModeSpecificContent = () => {
    if (isUser || !message.metadata) {
      return null;
    }

    switch (message.mode) {
      case 'translation':
        if (message.metadata.translatedText && message.metadata.originalText) {
          const translationResult: TranslationResult = {
            original: message.metadata.originalText,
            translated: message.metadata.translatedText,
            direction: 'auto', // This would come from the context/direction
            confidence: message.metadata.confidence || 0.9,
            alternatives: message.metadata.alternatives
          };
          
          return (
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <TranslationDisplay result={translationResult} />
            </div>
          );
        }
        break;
        
      case 'learning':
        if (message.metadata.explanation) {
          const explanation: LearningExplanation = {
            grammar: message.metadata.explanation.grammar || '',
            usage: message.metadata.explanation.usage || '',
            cultural: message.metadata.explanation.cultural,
            examples: message.metadata.explanation.examples || [],
            vocabulary: message.metadata.explanation.vocabulary || []
          };
          
          return (
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <LearningCard 
                explanation={explanation} 
                originalText={message.metadata.originalText || ''} 
              />
            </div>
          );
        }
        break;
        
      case 'conversation':
        // Could add context hints for conversation mode
        if (message.metadata.hints) {
          return (
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <ContextHints hints={message.metadata.hints} type="usage" />
            </div>
          );
        }
        break;
    }
    
    return null;
  };
  
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 'var(--spacing-md)',
      padding: '0 var(--spacing-md)'
    }}>
      <div style={{
        maxWidth: '80%',
        minWidth: '120px'
      }}>
        {/* Main message bubble */}
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
          
          {/* Mode indicator for assistant messages */}
          {!isUser && message.mode && message.mode !== 'conversation' && (
            <div style={{
              marginTop: 'var(--spacing-xs)',
              padding: '2px 6px',
              backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : 'var(--color-primary)',
              color: isUser ? 'white' : 'white',
              borderRadius: '3px',
              fontSize: 'var(--font-size-xs)',
              fontWeight: '500',
              display: 'inline-block'
            }}>
              {message.mode.charAt(0).toUpperCase() + message.mode.slice(1)} Mode
            </div>
          )}
        </div>
        
        {/* Mode-specific enhanced content */}
        {renderModeSpecificContent()}
        
        {/* Timestamp and metadata */}
        <div style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)',
          marginTop: 'var(--spacing-xs)',
          textAlign: isUser ? 'right' : 'left' as const,
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          <span>
            {message.timestamp.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
          
          {/* Confidence indicator for assistant messages */}
          {!isUser && message.metadata?.confidence && (
            <span style={{
              color: message.metadata.confidence > 0.8 ? 'var(--color-success)' : 
                     message.metadata.confidence > 0.6 ? 'var(--color-warning)' : 
                     'var(--color-error)'
            }}>
              {Math.round(message.metadata.confidence * 100)}% confidence
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;