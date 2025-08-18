import React from 'react';

const Header: React.FC = () => {
  return (
    <header style={{
      backgroundColor: 'var(--color-surface-elevated)',
      borderBottom: '1px solid var(--color-border)',
      padding: 'var(--spacing-md) 0',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div className="container">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-primary)'
          }}>
            🇫🇯 Fijian AI Chat
          </h1>
          
          <div style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)'
          }}>
            Learn Fijian with AI
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;