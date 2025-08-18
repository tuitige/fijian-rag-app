import React from 'react';

interface ContextHintsProps {
  hints: string[];
  type?: 'cultural' | 'linguistic' | 'usage';
}

const ContextHints: React.FC<ContextHintsProps> = ({ hints, type = 'cultural' }) => {
  if (!hints || hints.length === 0) {
    return null;
  }

  const getIcon = () => {
    switch (type) {
      case 'cultural':
        return '🌺';
      case 'linguistic':
        return '🗣️';
      case 'usage':
        return '💡';
      default:
        return '💭';
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'cultural':
        return 'Cultural Context';
      case 'linguistic':
        return 'Language Notes';
      case 'usage':
        return 'Usage Tips';
      default:
        return 'Context Hints';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'cultural':
        return '#8B5CF6'; // Purple
      case 'linguistic':
        return '#06B6D4'; // Cyan
      case 'usage':
        return '#10B981'; // Emerald
      default:
        return '#6B7280'; // Gray
    }
  };

  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: '6px',
      backgroundColor: 'var(--color-surface-elevated)',
      overflow: 'hidden',
      margin: 'var(--spacing-sm) 0'
    }}>
      {/* Header */}
      <div style={{
        padding: 'var(--spacing-sm)',
        backgroundColor: getColor(),
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs)',
        fontSize: 'var(--font-size-sm)',
        fontWeight: '600'
      }}>
        <span>{getIcon()}</span>
        {getTitle()}
      </div>

      {/* Content */}
      <div style={{
        padding: 'var(--spacing-sm)'
      }}>
        {hints.map((hint, index) => (
          <div
            key={index}
            style={{
              padding: 'var(--spacing-sm)',
              margin: index > 0 ? 'var(--spacing-sm) 0 0 0' : '0',
              backgroundColor: 'var(--color-surface)',
              borderRadius: '4px',
              border: `1px solid ${getColor()}20`,
              borderLeft: `3px solid ${getColor()}`,
              fontSize: 'var(--font-size-sm)',
              lineHeight: '1.5',
              color: 'var(--color-text-secondary)'
            }}
          >
            {hint}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContextHints;