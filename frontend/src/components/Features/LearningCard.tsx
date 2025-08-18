import React from 'react';
import { LearningExplanation } from '../../types/llm';

interface LearningCardProps {
  explanation: LearningExplanation;
  originalText: string;
}

const LearningCard: React.FC<LearningCardProps> = ({ explanation, originalText }) => {
  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: '8px',
      backgroundColor: 'var(--color-surface-elevated)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-primary)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)'
      }}>
        <span style={{ fontSize: '1.2em' }}>📚</span>
        <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>
          Learning Explanation
        </h3>
      </div>

      {/* Original text */}
      <div style={{
        padding: 'var(--spacing-md)',
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)'
      }}>
        <h4 style={{
          margin: '0 0 var(--spacing-sm) 0',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)'
        }}>
          Analyzing:
        </h4>
        <div style={{
          padding: 'var(--spacing-sm)',
          backgroundColor: 'var(--color-surface-elevated)',
          borderRadius: '4px',
          border: '1px solid var(--color-border)',
          fontStyle: 'italic',
          fontSize: 'var(--font-size-base)'
        }}>
          "{originalText}"
        </div>
      </div>

      <div style={{ padding: 'var(--spacing-md)' }}>
        {/* Grammar explanation */}
        {explanation.grammar && (
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <h4 style={{
              margin: '0 0 var(--spacing-sm) 0',
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)'
            }}>
              <span>⚙️</span> Grammar
            </h4>
            <p style={{
              margin: 0,
              lineHeight: '1.6',
              color: 'var(--color-text-secondary)'
            }}>
              {explanation.grammar}
            </p>
          </div>
        )}

        {/* Usage explanation */}
        {explanation.usage && (
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <h4 style={{
              margin: '0 0 var(--spacing-sm) 0',
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)'
            }}>
              <span>💡</span> Usage
            </h4>
            <p style={{
              margin: 0,
              lineHeight: '1.6',
              color: 'var(--color-text-secondary)'
            }}>
              {explanation.usage}
            </p>
          </div>
        )}

        {/* Cultural context */}
        {explanation.cultural && (
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <h4 style={{
              margin: '0 0 var(--spacing-sm) 0',
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)'
            }}>
              <span>🌺</span> Cultural Context
            </h4>
            <p style={{
              margin: 0,
              lineHeight: '1.6',
              color: 'var(--color-text-secondary)'
            }}>
              {explanation.cultural}
            </p>
          </div>
        )}

        {/* Examples */}
        {explanation.examples && explanation.examples.length > 0 && (
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <h4 style={{
              margin: '0 0 var(--spacing-sm) 0',
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)'
            }}>
              <span>📝</span> Examples
            </h4>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-sm)'
            }}>
              {explanation.examples.map((example, index) => (
                <div
                  key={index}
                  style={{
                    padding: 'var(--spacing-sm)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: '4px',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-sm)',
                    lineHeight: '1.5'
                  }}
                >
                  {example}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vocabulary */}
        {explanation.vocabulary && explanation.vocabulary.length > 0 && (
          <div>
            <h4 style={{
              margin: '0 0 var(--spacing-sm) 0',
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)'
            }}>
              <span>📖</span> Vocabulary
            </h4>
            <div style={{
              display: 'grid',
              gap: 'var(--spacing-sm)',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'
            }}>
              {explanation.vocabulary.map((vocab, index) => (
                <div
                  key={index}
                  style={{
                    padding: 'var(--spacing-sm)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: '4px',
                    border: '1px solid var(--color-border)'
                  }}
                >
                  <div style={{
                    fontWeight: '600',
                    color: 'var(--color-text-primary)',
                    marginBottom: '2px'
                  }}>
                    {vocab.word}
                    {vocab.pronunciation && (
                      <span style={{
                        marginLeft: 'var(--spacing-xs)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-secondary)',
                        fontWeight: '400'
                      }}>
                        [{vocab.pronunciation}]
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    lineHeight: '1.4'
                  }}>
                    {vocab.meaning}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LearningCard;