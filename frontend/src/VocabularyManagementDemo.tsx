import React from 'react';
import VocabularyManagement from '../components/VocabularyManagement/VocabularyManagement';

const VocabularyManagementDemo: React.FC = () => {
  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: 'var(--color-background)'
    }}>
      <header style={{
        backgroundColor: 'var(--color-surface-elevated)',
        borderBottom: '1px solid var(--color-border)',
        padding: 'var(--spacing-md) 0',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 var(--spacing-md)' }}>
          <h1 style={{
            margin: 0,
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-primary)'
          }}>
            🇫🇯 Fijian AI Chat - Data Management Demo
          </h1>
        </div>
      </header>
      
      <VocabularyManagement />
    </div>
  );
};

export default VocabularyManagementDemo;