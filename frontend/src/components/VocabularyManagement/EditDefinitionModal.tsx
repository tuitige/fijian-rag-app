import React, { useState, useEffect } from 'react';
import { VocabularyRecord } from '../../types/vocabulary';
import VocabularyManagementService from '../../services/vocabularyManagementService';

interface EditDefinitionModalProps {
  word: VocabularyRecord;
  onDefinitionUpdated: (updatedRecord: VocabularyRecord) => void;
  onClose: () => void;
}

const EditDefinitionModal: React.FC<EditDefinitionModalProps> = ({
  word,
  onDefinitionUpdated,
  onClose
}) => {
  const [definition, setDefinition] = useState(word.definition || '');
  const [context, setContext] = useState(word.context || '');
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset form when word changes
    setDefinition(word.definition || '');
    setContext(word.context || '');
    setError(null);
  }, [word]);

  const handleSuggest = async () => {
    try {
      setSuggesting(true);
      setError(null);
      
      const response = await VocabularyManagementService.suggestDefinition({
        word: word.word,
        context: word.context || word.articleIds?.[0] // Use existing context or first article reference
      });
      
      setDefinition(response.suggestedDefinition);
    } catch (err) {
      console.error('Error getting suggestion:', err);
      setError('Failed to get AI suggestion. Please try again.');
    } finally {
      setSuggesting(false);
    }
  };

  const handleSave = async () => {
    if (!definition.trim()) {
      setError('Definition is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await VocabularyManagementService.updateDefinition(word.word, {
        definition: definition.trim(),
        context: context.trim() || undefined
      });
      
      onDefinitionUpdated(response.record);
    } catch (err) {
      console.error('Error updating definition:', err);
      setError(err instanceof Error ? err.message : 'Failed to update definition');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 'var(--spacing-md)'
        }}
        onClick={onClose}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Modal */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--border-radius-lg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-lg)',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            padding: 'var(--spacing-xl)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-lg)'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text)'
            }}>
              Edit Definition: "{word.word}"
            </h3>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 'var(--font-size-lg)',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                padding: 'var(--spacing-xs)'
              }}
            >
              ×
            </button>
          </div>

          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--spacing-sm)'
            }}>
              <strong>Frequency:</strong> {word.frequency.toLocaleString()} occurrences
              {word.sources && word.sources.length > 0 && (
                <>
                  <br />
                  <strong>Sources:</strong> {word.sources.join(', ')}
                </>
              )}
            </div>
          </div>

          {error && (
            <div style={{
              backgroundColor: 'var(--color-error-light)',
              color: 'var(--color-error)',
              padding: 'var(--spacing-sm)',
              borderRadius: 'var(--border-radius-sm)',
              border: '1px solid var(--color-error)',
              marginBottom: 'var(--spacing-md)',
              fontSize: 'var(--font-size-sm)'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-sm)'
            }}>
              <label style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text)'
              }}>
                Definition *
              </label>
              <button
                onClick={handleSuggest}
                disabled={suggesting}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  fontSize: 'var(--font-size-xs)',
                  backgroundColor: suggesting ? 'var(--color-surface)' : 'var(--color-secondary)',
                  color: suggesting ? 'var(--color-text-muted)' : 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-sm)',
                  cursor: suggesting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {suggesting ? '🤖 Suggesting...' : '🤖 Suggest with AI'}
              </button>
            </div>
            <textarea
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder="Enter a clear, concise English definition for this Fijian word..."
              style={{
                width: '100%',
                minHeight: '100px',
                padding: 'var(--spacing-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: 'var(--font-size-sm)',
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text)',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              rows={4}
            />
          </div>

          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label style={{
              display: 'block',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text)',
              marginBottom: 'var(--spacing-sm)'
            }}>
              Additional Context (Optional)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Add any additional context, usage notes, or examples..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: 'var(--spacing-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: 'var(--font-size-sm)',
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text)',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              rows={3}
            />
          </div>

          <div style={{
            display: 'flex',
            gap: 'var(--spacing-md)',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                fontSize: 'var(--font-size-sm)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--border-radius-sm)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !definition.trim()}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                fontSize: 'var(--font-size-sm)',
                backgroundColor: loading || !definition.trim() ? 'var(--color-surface)' : 'var(--color-primary)',
                color: loading || !definition.trim() ? 'var(--color-text-muted)' : 'white',
                border: 'none',
                borderRadius: 'var(--border-radius-sm)',
                cursor: loading || !definition.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'Saving...' : 'Save Definition'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditDefinitionModal;