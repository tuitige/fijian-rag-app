import React, { KeyboardEvent } from 'react';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Type your message in English or Fijian..."
}) => {
  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend();
      }
    }
  };

  const handleSend = () => {
    if (value.trim() && !disabled) {
      onSend();
    }
  };

  return (
    <div style={{
      padding: 'var(--spacing-md)',
      borderTop: '1px solid var(--color-border)',
      backgroundColor: 'var(--color-surface-elevated)',
      boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-sm)',
        alignItems: 'flex-end',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ flex: 1 }}>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            style={{
              width: '100%',
              minHeight: '44px',
              maxHeight: '120px',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-lg)',
              fontSize: 'var(--font-size-base)',
              fontFamily: 'var(--font-family-base)',
              resize: 'none' as const,
              lineHeight: 'var(--line-height-normal)',
              transition: 'border-color var(--transition-fast)',
              outline: 'none'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--color-primary)';
              e.target.style.boxShadow = '0 0 0 3px var(--color-primary-light)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--color-border)';
              e.target.style.boxShadow = 'none';
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          
          <div style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
            marginTop: 'var(--spacing-xs)',
            textAlign: 'right' as const
          }}>
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
        
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="button button-primary"
          style={{
            height: '44px',
            minWidth: '80px',
            borderRadius: 'var(--border-radius-lg)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--spacing-xs)'
          }}
          aria-label="Send message"
        >
          <span>Send</span>
          <span style={{ fontSize: 'var(--font-size-lg)' }}>📤</span>
        </button>
      </div>
    </div>
  );
};

export default MessageInput;