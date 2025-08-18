import React from 'react';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div style={{ 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--color-background)'
    }}>
      <Header />
      
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {children}
      </main>
      
      <footer style={{
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        padding: 'var(--spacing-sm) 0',
        textAlign: 'center' as const,
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-muted)'
      }}>
        <div className="container">
          Fijian AI - Preserving language through technology
        </div>
      </footer>
    </div>
  );
};

export default Layout;