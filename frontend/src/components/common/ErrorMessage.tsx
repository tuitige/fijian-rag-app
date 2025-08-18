import React from 'react';
import { ApiError } from '../../types/api';

interface ErrorMessageProps {
  error: ApiError | string;
  onRetry?: () => void;
  className?: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  error, 
  onRetry, 
  className = '' 
}) => {
  const errorMessage = typeof error === 'string' 
    ? error 
    : error.message || error.error || 'An unexpected error occurred';

  const errorType = typeof error === 'object' ? error.type : undefined;

  return (
    <div 
      className={`error-message ${className}`}
      role="alert"
      style={{
        padding: 'var(--spacing-md)',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 'var(--border-radius-md)',
        color: 'var(--color-error)',
        marginBottom: 'var(--spacing-md)'
      }}
    >
      <div style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-sm)' }}>
        {errorType === 'Network error' ? '🌐 Connection Error' : '⚠️ Error'}
      </div>
      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
        {errorMessage}
      </p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="button button-secondary"
          style={{ 
            marginTop: 'var(--spacing-sm)',
            fontSize: 'var(--font-size-xs)',
            padding: 'var(--spacing-xs) var(--spacing-sm)'
          }}
        >
          Try Again
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;