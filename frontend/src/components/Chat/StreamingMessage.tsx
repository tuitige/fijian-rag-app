import React, { useState, useEffect } from 'react';
import { StreamChunk } from '../../types/llm';

interface StreamingMessageProps {
  chunks: StreamChunk[];
  isComplete: boolean;
  className?: string;
}

const StreamingMessage: React.FC<StreamingMessageProps> = ({
  chunks,
  isComplete,
  className
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);

  useEffect(() => {
    if (chunks.length === 0) {
      setDisplayedText('');
      setCurrentChunkIndex(0);
      return;
    }

    // Accumulate text from all chunks up to current index
    const accumulatedText = chunks
      .slice(0, currentChunkIndex + 1)
      .map(chunk => chunk.content)
      .join('');

    setDisplayedText(accumulatedText);

    // Auto-advance to next chunk if available and not complete
    if (!isComplete && currentChunkIndex < chunks.length - 1) {
      const timer = setTimeout(() => {
        setCurrentChunkIndex(prev => prev + 1);
      }, 50); // Small delay for smooth streaming effect

      return () => clearTimeout(timer);
    }
  }, [chunks, currentChunkIndex, isComplete]);

  // Get the full text when streaming is complete
  const fullText = chunks.map(chunk => chunk.content).join('');
  const textToShow = isComplete ? fullText : displayedText;

  // CSS for blinking cursor
  const blinkAnimation = `
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
  `;

  return (
    <div className={className}>
      <style>{blinkAnimation}</style>
      <div style={{
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap'
      }}>
        {textToShow}
        {!isComplete && (
          <span 
            style={{
              display: 'inline-block',
              width: '8px',
              height: '1em',
              backgroundColor: 'var(--color-primary)',
              marginLeft: '2px',
              animation: 'blink 1s infinite'
            }}
          />
        )}
      </div>
      
      {/* Show confidence if available */}
      {isComplete && chunks.length > 0 && chunks[chunks.length - 1].metadata?.confidence && (
        <div style={{
          marginTop: 'var(--spacing-xs)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)'
        }}>
          <span>Confidence:</span>
          <div style={{
            width: '60px',
            height: '4px',
            backgroundColor: 'var(--color-border)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div
              style={{
                width: `${(chunks[chunks.length - 1].metadata?.confidence || 0) * 100}%`,
                height: '100%',
                backgroundColor: 'var(--color-success)',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
          <span>{Math.round((chunks[chunks.length - 1].metadata?.confidence || 0) * 100)}%</span>
        </div>
      )}

      {/* Show alternatives if available */}
      {isComplete && chunks.length > 0 && chunks[chunks.length - 1].metadata?.alternatives && (
        <details style={{
          marginTop: 'var(--spacing-sm)',
          fontSize: 'var(--font-size-sm)'
        }}>
          <summary style={{
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-xs)'
          }}>
            Show alternatives ({chunks[chunks.length - 1].metadata?.alternatives?.length})
          </summary>
          <div style={{
            marginTop: 'var(--spacing-xs)',
            paddingLeft: 'var(--spacing-sm)'
          }}>
            {chunks[chunks.length - 1].metadata?.alternatives?.map((alt, index) => (
              <div
                key={index}
                style={{
                  padding: 'var(--spacing-xs)',
                  margin: 'var(--spacing-xs) 0',
                  backgroundColor: 'var(--color-surface-elevated)',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-sm)'
                }}
              >
                {alt}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

export default StreamingMessage;