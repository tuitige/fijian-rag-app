import React, { useState } from 'react';

interface CulturalNote {
  id: string;
  title: string;
  content: string;
  category: 'tradition' | 'etiquette' | 'history' | 'language' | 'customs';
  relatedWords?: string[];
  importance: 'low' | 'medium' | 'high';
}

interface CulturalNotesProps {
  word?: string;
  notes?: CulturalNote[];
  expanded?: boolean;
  showCategories?: boolean;
}

const CulturalNotes: React.FC<CulturalNotesProps> = ({
  word,
  notes = [],
  expanded = false,
  showCategories = true
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Mock cultural notes if none provided
  const defaultNotes: CulturalNote[] = word ? [
    {
      id: '1',
      title: 'Traditional Greeting',
      content: `"${word}" is more than just a word - it's a way of life in Fiji. When Fijians say "${word}", they're not just greeting you; they're wishing you good health, happiness, and prosperity. It's customary to respond with "${word}" as well, often accompanied by a warm smile.`,
      category: 'tradition',
      relatedWords: [word],
      importance: 'high'
    },
    {
      id: '2',
      title: 'Cultural Context',
      content: `In Fijian culture, greetings are very important. "${word}" can be used at any time of day and with anyone, regardless of their social status. It reflects the Fijian values of warmth, hospitality, and community spirit.`,
      category: 'etiquette',
      relatedWords: [word],
      importance: 'medium'
    }
  ] : [];

  const culturalNotes = notes.length > 0 ? notes : defaultNotes;

  const categories = [
    { id: 'all', name: 'All', icon: '🌺' },
    { id: 'tradition', name: 'Traditions', icon: '🏛️' },
    { id: 'etiquette', name: 'Etiquette', icon: '🤝' },
    { id: 'history', name: 'History', icon: '📜' },
    { id: 'language', name: 'Language', icon: '🗣️' },
    { id: 'customs', name: 'Customs', icon: '🎭' }
  ];

  const filteredNotes = selectedCategory === 'all' 
    ? culturalNotes 
    : culturalNotes.filter(note => note.category === selectedCategory);

  const getImportanceColor = (importance: CulturalNote['importance']): string => {
    switch (importance) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getImportanceLabel = (importance: CulturalNote['importance']): string => {
    switch (importance) {
      case 'high': return 'Essential';
      case 'medium': return 'Important';
      case 'low': return 'Good to know';
      default: return '';
    }
  };

  if (culturalNotes.length === 0) {
    return null;
  }

  return (
    <div style={{
      backgroundColor: 'var(--color-surface-elevated)',
      borderRadius: '12px',
      border: '1px solid var(--color-border)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div
        style={{
          padding: 'var(--spacing-md)',
          backgroundColor: '#8B5CF6',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          <span style={{ fontSize: '1.25rem' }}>🌺</span>
          <h3 style={{
            margin: 0,
            fontSize: 'var(--font-size-lg)',
            fontWeight: '600'
          }}>
            Cultural Context
            {word && (
              <span style={{
                marginLeft: 'var(--spacing-sm)',
                fontSize: 'var(--font-size-base)',
                opacity: 0.9
              }}>
                for "{word}"
              </span>
            )}
          </h3>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          <span style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: 'var(--font-size-xs)',
            fontWeight: '500'
          }}>
            {filteredNotes.length} note{filteredNotes.length !== 1 ? 's' : ''}
          </span>
          <span style={{
            fontSize: '1rem',
            transition: 'transform 0.2s ease',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            ▼
          </span>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div style={{ padding: 'var(--spacing-md)' }}>
          {/* Category filter */}
          {showCategories && categories.length > 1 && (
            <div style={{
              marginBottom: 'var(--spacing-lg)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--spacing-xs)'
            }}>
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    backgroundColor: selectedCategory === category.id 
                      ? '#8B5CF6' 
                      : 'var(--color-surface)',
                    color: selectedCategory === category.id 
                      ? 'white' 
                      : 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>{category.icon}</span>
                  {category.name}
                </button>
              ))}
            </div>
          )}

          {/* Notes */}
          {filteredNotes.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: 'var(--spacing-xl)',
              color: 'var(--color-text-secondary)',
              fontStyle: 'italic'
            }}>
              No cultural notes found for this category.
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-md)'
            }}>
              {filteredNotes.map(note => (
                <div
                  key={note.id}
                  style={{
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    borderLeft: `4px solid ${getImportanceColor(note.importance)}`
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 'var(--spacing-sm)'
                  }}>
                    <h4 style={{
                      margin: 0,
                      color: 'var(--color-text-primary)',
                      fontSize: 'var(--font-size-base)',
                      fontWeight: '600'
                    }}>
                      {note.title}
                    </h4>
                    
                    <span style={{
                      padding: '2px 6px',
                      backgroundColor: getImportanceColor(note.importance) + '20',
                      color: getImportanceColor(note.importance),
                      borderRadius: '4px',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: '500'
                    }}>
                      {getImportanceLabel(note.importance)}
                    </span>
                  </div>

                  <p style={{
                    margin: '0 0 var(--spacing-sm) 0',
                    color: 'var(--color-text-secondary)',
                    fontSize: 'var(--font-size-sm)',
                    lineHeight: '1.6'
                  }}>
                    {note.content}
                  </p>

                  {note.relatedWords && note.relatedWords.length > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-xs)',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-secondary)',
                        fontWeight: '500'
                      }}>
                        Related words:
                      </span>
                      {note.relatedWords.map((relatedWord, index) => (
                        <span
                          key={index}
                          style={{
                            padding: '2px 6px',
                            backgroundColor: '#8B5CF620',
                            color: '#8B5CF6',
                            borderRadius: '4px',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: '500'
                          }}
                        >
                          {relatedWord}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Learn more link */}
          <div style={{
            marginTop: 'var(--spacing-md)',
            padding: 'var(--spacing-sm)',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            textAlign: 'center'
          }}>
            <span style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)'
            }}>
              💡 Want to learn more about Fijian culture? 
            </span>
            <button
              style={{
                marginLeft: 'var(--spacing-xs)',
                backgroundColor: 'transparent',
                color: '#8B5CF6',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontWeight: '500',
                textDecoration: 'underline'
              }}
            >
              Explore Cultural Guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CulturalNotes;