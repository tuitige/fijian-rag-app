import React from 'react';
import { TranslationResult } from '../../types/llm';

interface TranslationDisplayProps {
  result: TranslationResult;
}

const TranslationDisplay: React.FC<TranslationDisplayProps> = ({ result }) => {
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // You could add a toast notification here
      console.log('Text copied to clipboard');
    });
  };

  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: 'var(--color-surface-elevated)'
    }}>
      {/* Direction indicator */}
      <div style={{
        padding: 'var(--spacing-sm)',
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-secondary)'
      }}>
        <span>Translation:</span>
        <span style={{ fontWeight: '600' }}>
          {result.direction === 'fj-en' ? 'Fijian → English' : 
           result.direction === 'en-fj' ? 'English → Fijian' : 
           'Auto-detected'}
        </span>
        {result.confidence && (
          <span style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)'
          }}>
            Confidence: {Math.round(result.confidence * 100)}%
          </span>
        )}
      </div>

      {/* Original and translated text */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1px',
        backgroundColor: 'var(--color-border)'
      }}>
        {/* Original text */}
        <div style={{
          padding: 'var(--spacing-md)',
          backgroundColor: 'var(--color-surface-elevated)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-sm)'
          }}>
            <h4 style={{
              margin: 0,
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              fontWeight: '600'
            }}>
              {result.direction === 'fj-en' || result.direction === 'auto' ? 'Fijian' : 'English'}
            </h4>
            <button
              onClick={() => handleCopy(result.original)}
              style={{
                padding: '2px 6px',
                fontSize: 'var(--font-size-xs)',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                backgroundColor: 'var(--color-surface)',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)'
              }}
              title="Copy original text"
            >
              📋 Copy
            </button>
          </div>
          <div style={{
            fontSize: 'var(--font-size-base)',
            lineHeight: '1.5',
            color: 'var(--color-text-primary)'
          }}>
            {result.original}
          </div>
        </div>

        {/* Translated text */}
        <div style={{
          padding: 'var(--spacing-md)',
          backgroundColor: 'var(--color-surface-elevated)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-sm)'
          }}>
            <h4 style={{
              margin: 0,
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              fontWeight: '600'
            }}>
              {result.direction === 'en-fj' || result.direction === 'auto' ? 'Fijian' : 'English'}
            </h4>
            <button
              onClick={() => handleCopy(result.translated)}
              style={{
                padding: '2px 6px',
                fontSize: 'var(--font-size-xs)',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                backgroundColor: 'var(--color-surface)',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)'
              }}
              title="Copy translation"
            >
              📋 Copy
            </button>
          </div>
          <div style={{
            fontSize: 'var(--font-size-base)',
            lineHeight: '1.5',
            color: 'var(--color-text-primary)',
            fontWeight: '500'
          }}>
            {result.translated}
          </div>
        </div>
      </div>

      {/* Alternative translations */}
      {result.alternatives && result.alternatives.length > 0 && (
        <details style={{
          padding: 'var(--spacing-sm)',
          borderTop: '1px solid var(--color-border)'
        }}>
          <summary style={{
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            fontWeight: '600'
          }}>
            Alternative translations ({result.alternatives.length})
          </summary>
          <div style={{
            marginTop: 'var(--spacing-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-xs)'
          }}>
            {result.alternatives.map((alt, index) => (
              <div
                key={index}
                style={{
                  padding: 'var(--spacing-sm)',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>{alt}</span>
                <button
                  onClick={() => handleCopy(alt)}
                  style={{
                    padding: '2px 4px',
                    fontSize: 'var(--font-size-xs)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '3px',
                    backgroundColor: 'var(--color-surface-elevated)',
                    cursor: 'pointer',
                    color: 'var(--color-text-secondary)'
                  }}
                  title="Copy alternative"
                >
                  📋
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

export default TranslationDisplay;