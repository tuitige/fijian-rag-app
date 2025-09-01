import React from 'react';
import { VocabularyRecord } from '../../types/vocabulary';

interface VocabularyTableProps {
  data: VocabularyRecord[];
  loading: boolean;
  onEditDefinition: (word: VocabularyRecord) => void;
  onLoadMore?: () => void;
}

const VocabularyTable: React.FC<VocabularyTableProps> = ({
  data,
  loading,
  onEditDefinition,
  onLoadMore
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (data.length === 0 && !loading) {
    return (
      <div style={{
        textAlign: 'center',
        padding: 'var(--spacing-xl)',
        color: 'var(--color-text-secondary)'
      }}>
        <p>No vocabulary records found with the current filters.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--border-radius-md)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden'
      }}>
        <div style={{
          overflowX: 'auto',
          maxHeight: '70vh'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr style={{
                backgroundColor: 'var(--color-surface-elevated)',
                borderBottom: '2px solid var(--color-border)'
              }}>
                <th style={{
                  padding: 'var(--spacing-md)',
                  textAlign: 'left',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text)',
                  minWidth: '120px'
                }}>
                  Word
                </th>
                <th style={{
                  padding: 'var(--spacing-md)',
                  textAlign: 'left',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text)',
                  width: '80px'
                }}>
                  Frequency
                </th>
                <th style={{
                  padding: 'var(--spacing-md)',
                  textAlign: 'left',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text)',
                  minWidth: '200px'
                }}>
                  Definition
                </th>
                <th style={{
                  padding: 'var(--spacing-md)',
                  textAlign: 'left',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text)',
                  minWidth: '150px'
                }}>
                  Context
                </th>
                <th style={{
                  padding: 'var(--spacing-md)',
                  textAlign: 'left',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text)',
                  width: '100px'
                }}>
                  Last Seen
                </th>
                <th style={{
                  padding: 'var(--spacing-md)',
                  textAlign: 'left',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text)',
                  width: '100px'
                }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((record, index) => (
                <tr
                  key={record.word}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    backgroundColor: index % 2 === 0 ? 'var(--color-background)' : 'var(--color-surface)'
                  }}
                >
                  <td style={{
                    padding: 'var(--spacing-md)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text)',
                    fontWeight: 'var(--font-weight-semibold)'
                  }}>
                    {record.word}
                  </td>
                  <td style={{
                    padding: 'var(--spacing-md)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text)',
                    textAlign: 'center'
                  }}>
                    {record.frequency.toLocaleString()}
                  </td>
                  <td style={{
                    padding: 'var(--spacing-md)',
                    fontSize: 'var(--font-size-sm)',
                    color: record.definition ? 'var(--color-text)' : 'var(--color-text-muted)'
                  }}>
                    {record.definition ? (
                      <span title={record.definition}>
                        {truncateText(record.definition, 80)}
                      </span>
                    ) : (
                      <em>No definition</em>
                    )}
                  </td>
                  <td style={{
                    padding: 'var(--spacing-md)',
                    fontSize: 'var(--font-size-sm)',
                    color: record.context ? 'var(--color-text-secondary)' : 'var(--color-text-muted)'
                  }}>
                    {record.context ? (
                      <span title={record.context}>
                        {truncateText(record.context, 60)}
                      </span>
                    ) : (
                      <em>No context</em>
                    )}
                  </td>
                  <td style={{
                    padding: 'var(--spacing-md)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-secondary)'
                  }}>
                    {formatDate(record.lastSeen)}
                  </td>
                  <td style={{
                    padding: 'var(--spacing-md)'
                  }}>
                    <button
                      onClick={() => onEditDefinition(record)}
                      style={{
                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                        fontSize: 'var(--font-size-xs)',
                        backgroundColor: 'var(--color-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--border-radius-sm)',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                      }}
                    >
                      {record.definition ? 'Edit' : 'Add'} Definition
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {onLoadMore && (
        <div style={{
          textAlign: 'center',
          marginTop: 'var(--spacing-lg)'
        }}>
          <button
            onClick={onLoadMore}
            disabled={loading}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              fontSize: 'var(--font-size-sm)',
              backgroundColor: loading ? 'var(--color-surface)' : 'var(--color-secondary)',
              color: loading ? 'var(--color-text-muted)' : 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-sm)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
};

export default VocabularyTable;