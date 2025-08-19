import React, { useState } from 'react';
import Layout from './components/Layout/Layout';
import { ChatContainer } from './components/Chat';
// import { Auth, ProtectedRoute } from './components/Auth'; // TODO: Will be used for authentication features
import { UserProfile } from './components/Profile';
import LearningFeaturesDemo from './components/LearningFeaturesDemo';
import { ChatModeProvider } from './contexts/ChatModeContext';
import { AuthProvider } from './contexts/AuthContext';
import { UserProgressProvider } from './contexts/UserProgressContext';
import { useAuth } from './contexts/AuthContext';
import './styles/globals.css';

const AuthenticatedApp: React.FC = () => {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState<'chat' | 'demo'>('chat');

  const renderPage = () => {
    switch (currentPage) {
      case 'demo':
        return <LearningFeaturesDemo />;
      case 'chat':
      default:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {user && <UserProfile />}
            <ChatContainer />
          </div>
        );
    }
  };

  return (
    <UserProgressProvider>
      <ChatModeProvider>
        <Layout>
          {/* Simple navigation */}
          <div style={{
            display: 'flex',
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-lg)',
            padding: 'var(--spacing-sm)',
            backgroundColor: 'var(--color-surface-elevated)',
            borderRadius: '8px',
            border: '1px solid var(--color-border)'
          }}>
            <button
              onClick={() => setCurrentPage('chat')}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                backgroundColor: currentPage === 'chat' ? 'var(--color-primary)' : 'transparent',
                color: currentPage === 'chat' ? 'white' : 'var(--color-text-primary)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              💬 Chat
            </button>
            <button
              onClick={() => setCurrentPage('demo')}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                backgroundColor: currentPage === 'demo' ? 'var(--color-primary)' : 'transparent',
                color: currentPage === 'demo' ? 'white' : 'var(--color-text-primary)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              🧠 Learning Features Demo
            </button>
          </div>
          
          {renderPage()}
        </Layout>
      </ChatModeProvider>
    </UserProgressProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      {/* Temporarily bypass auth for demo */}
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App;
