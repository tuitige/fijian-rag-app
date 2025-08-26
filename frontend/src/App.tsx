import React from 'react';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import { ChatContainer } from './components/Chat';
import LearningFeaturesDemo from './components/LearningFeaturesDemo';
import { ChatModeProvider } from './contexts/ChatModeContext';
import { UserProgressProvider } from './contexts/UserProgressContext';
import './styles/globals.css';

function App() {
  const auth = useAuth();

  if (auth.isLoading) {
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

  if (auth.error) {
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
          <div>Encountering error... {auth.error}</div>
        </div>
      </Layout>
    );
  }

  if (auth.isAuthenticated) {
    return (
      <UserProgressProvider>
        <ChatModeProvider>
          <Layout>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <ChatContainer />
              <LearningFeaturesDemo />
            </div>
          </Layout>
        </ChatModeProvider>
      </UserProgressProvider>
    );
  }

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
        <h3>Welcome to Fijian RAG App</h3>
        <p>Please sign in to access your personalized learning experience.</p>
      </div>
    </Layout>
  );
}

export default App;
