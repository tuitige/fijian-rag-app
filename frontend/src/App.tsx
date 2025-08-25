import React, { useState, useEffect } from 'react';
import Layout from './components/Layout/Layout';
import { ChatContainer } from './components/Chat';
import CognitoAuth from './components/Auth/CognitoAuth';
// import { Auth, ProtectedRoute } from './components/Auth'; // TODO: Will be used for authentication features
import { UserProfile } from './components/Profile';
import LearningFeaturesDemo from './components/LearningFeaturesDemo';
import { ChatModeProvider } from './contexts/ChatModeContext';
import { AuthProvider } from './contexts/AuthContext';
import { UserProgressProvider } from './contexts/UserProgressContext';
import { useAuth } from './contexts/AuthContext';
import './styles/globals.css';

const AuthenticatedApp: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<'chat' | 'demo'>('chat');

  // Add deployment info logging
  useEffect(() => {
    const buildTime = new Date().toISOString();
    console.log('🚀 Fijian RAG App - Frontend Build Info:');
    console.log('  Build deployed at:', buildTime);
    console.log('  Environment:', process.env.REACT_APP_ENVIRONMENT);
    console.log('  API URL:', process.env.REACT_APP_API_BASE_URL);
    console.log('  Version: v2.0-prod-debug');
  // Unique log for deployment verification
  console.log('*** Deployment Test: If you see this, the deployment is LIVE! [2025-08-25] ***');
  }, []);

  if (isLoading) {
    return (
      <Layout>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '50vh',
          flexDirection: 'column',
          gap: 'var(--spacing-md)'
        }}>
          <div className="spinner" style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--color-border)',
            borderTop: '3px solid var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span>Loading Fijian RAG App...</span>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <CognitoAuth />
      </Layout>
    );
  }

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
          {/* Cognito Auth Status Bar */}
          <CognitoAuth />
          
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
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App;
