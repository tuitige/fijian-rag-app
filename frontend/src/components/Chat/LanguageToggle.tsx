import React from 'react';
import { TranslationDirection } from '../../types/llm';
import { useChatMode } from '../../contexts/ChatModeContext';

const LanguageToggle: React.FC = () => {
  const { direction, setDirection, mode } = useChatMode();

  // Only show for translation mode
  if (mode !== 'translation') {
    return null;
  }

  const directions: Array<{
    value: TranslationDirection;
    label: string;
    icon: string;
  }> = [
    {
      value: 'auto',
      label: 'Auto-detect',
      icon: '🔍'
    },
    {
      value: 'fj-en',
      label: 'Fijian → English',
      icon: '🇫🇯→🇬🇧'
    },
    {
      value: 'en-fj',
      label: 'English → Fijian',
      icon: '🇬🇧→🇫🇯'
    }
  ];

  return (
    <div style={{
      display: 'flex',
      gap: 'var(--spacing-xs)',
      padding: 'var(--spacing-sm)',
      backgroundColor: 'var(--color-surface-elevated)',
      borderRadius: '6px',
      border: '1px solid var(--color-border)',
      alignItems: 'center'
    }}>
      <span style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-secondary)',
        marginRight: 'var(--spacing-xs)'
      }}>
        Direction:
      </span>
      
      <div style={{
        display: 'flex',
        gap: '2px',
        borderRadius: '4px',
        overflow: 'hidden',
        border: '1px solid var(--color-border)'
      }}>
        {directions.map((dir) => (
          <button
            key={dir.value}
            onClick={() => setDirection(dir.value)}
            style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              border: 'none',
              backgroundColor: direction === dir.value ? 'var(--color-primary)' : 'var(--color-surface)',
              color: direction === dir.value ? 'white' : 'var(--color-text-primary)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-xs)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
            title={dir.label}
          >
            <span style={{ marginRight: '4px' }}>{dir.icon}</span>
            {dir.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageToggle;