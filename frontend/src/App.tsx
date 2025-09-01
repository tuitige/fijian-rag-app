import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import { ChatContainer } from './components/Chat';
import LearningFeaturesDemo from './components/LearningFeaturesDemo';
import VocabularyManagement from './components/VocabularyManagement/VocabularyManagement';
import { ChatModeProvider } from './contexts/ChatModeContext';
import { UserProgressProvider } from './contexts/UserProgressContext';
import './styles/globals.css';

function App() {
  const auth = useAuth();

  return (
    <Router>
      {auth.isLoading ? (
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
      ) : auth.error ? (
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
      ) : auth.isAuthenticated ? (
        <UserProgressProvider>
          <ChatModeProvider>
            <Layout>
              <Routes>
                <Route path="/" element={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <ChatContainer />
                    <LearningFeaturesDemo />
                  </div>
                } />
                <Route path="/vocabulary-management" element={<VocabularyManagement />} />
              </Routes>
            </Layout>
          </ChatModeProvider>
        </UserProgressProvider>
      ) : (
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
      )}
    </Router>
  );
}

export default App;
