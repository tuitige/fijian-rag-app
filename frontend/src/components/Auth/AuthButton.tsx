import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const AuthButton: React.FC = () => {
  const auth = useAuth();

  // Don't render anything while loading
  if (auth.isLoading) {
    return null;
  }

  // Don't render anything if there's an error
  if (auth.error) {
    return null;
  }

  // Show Sign Out button when authenticated
  if (auth.isAuthenticated) {
    return (
      <button 
        onClick={() => auth.logoutFromCognito()}
        style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          backgroundColor: 'var(--color-danger)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: '500',
          fontSize: 'var(--font-size-sm)'
        }}
      >
        Sign Out
      </button>
    );
  }

  // Show Sign In button when not authenticated
  return (
    <button 
      onClick={() => auth.loginWithCognito()}
      style={{
        padding: 'var(--spacing-sm) var(--spacing-md)',
        backgroundColor: 'var(--color-primary)',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '500',
        fontSize: 'var(--font-size-sm)'
      }}
    >
      Sign In
    </button>
  );
};

export default AuthButton;