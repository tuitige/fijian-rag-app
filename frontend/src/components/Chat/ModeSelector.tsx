import React from 'react';
import { ChatMode } from '../../types/llm';
import { useChatMode } from '../../contexts/ChatModeContext';

const ModeSelector: React.FC = () => {
  const { mode, setMode } = useChatMode();

  const modes: Array<{
    value: ChatMode;
    label: string;
    icon: string;
    description: string;
  }> = [
    {
      value: 'conversation',
      label: 'Conversation',
      icon: '💬',
      description: 'Natural bilingual conversation with code-switching support'
    },
    {
      value: 'translation',
      label: 'Translation',
      icon: '🔄',
      description: 'Bidirectional Fijian-English translation'
    },
    {
      value: 'learning',
      label: 'Learning',
      icon: '📚',
      description: 'Grammar explanations and cultural context'
    }
  ];

  return (
    <div style={{
      display: 'flex',
      gap: 'var(--spacing-sm)',
      padding: 'var(--spacing-sm)',
      backgroundColor: 'var(--color-surface-elevated)',
      borderRadius: '8px',
      border: '1px solid var(--color-border)'
    }}>
      {modes.map((modeOption) => (
        <button
          key={modeOption.value}
          onClick={() => setMode(modeOption.value)}
          className={`mode-selector-button ${mode === modeOption.value ? 'active' : ''}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: 'var(--spacing-sm)',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            backgroundColor: mode === modeOption.value ? 'var(--color-primary)' : 'var(--color-surface)',
            color: mode === modeOption.value ? 'white' : 'var(--color-text-primary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            minWidth: '100px',
            fontSize: 'var(--font-size-sm)'
          }}
          title={modeOption.description}
        >
          <span style={{ fontSize: '1.2em', marginBottom: '4px' }}>
            {modeOption.icon}
          </span>
          <span style={{ fontWeight: mode === modeOption.value ? '600' : '400' }}>
            {modeOption.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default ModeSelector;