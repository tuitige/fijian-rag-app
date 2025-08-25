// Trigger: Minimal edit to test GitHub Actions frontend deploy workflow
import React from 'react';
import { useAuth } from "react-oidc-context";
import Layout from './components/Layout/Layout';
import { ChatContainer } from './components/Chat';
import LearningFeaturesDemo from './components/LearningFeaturesDemo';
import { ChatModeProvider } from './contexts/ChatModeContext';
import { UserProgressProvider } from './contexts/UserProgressContext';
import './styles/globals.css';

function App() {
  const auth = useAuth();

  const signOutRedirect = () => {
    const clientId = "4pvrvr5jf8h9bvi59asmlbdjcp";
    const logoutUri = "https://fijian-ai.org";
    const cognitoDomain = "https://fijian-auth.auth.us-west-2.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

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
          <div>Encountering error... {auth.error.message}</div>
        </div>
      </Layout>
    );
  }

  if (auth.isAuthenticated) {
    return (
      <UserProgressProvider>
        <ChatModeProvider>
          <Layout>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-lg)',
              padding: 'var(--spacing-sm)',
              backgroundColor: 'var(--color-surface-elevated)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)'
            }}>
              <div>
                <pre style={{ margin: 0, fontSize: '14px' }}>Hello: {auth.user?.profile.email}</pre>
                <pre style={{ margin: 0, fontSize: '12px', opacity: 0.7 }}>ID Token: {auth.user?.id_token?.substring(0, 20)}...</pre>
                <pre style={{ margin: 0, fontSize: '12px', opacity: 0.7 }}>Access Token: {auth.user?.access_token?.substring(0, 20)}...</pre>
                <pre style={{ margin: 0, fontSize: '12px', opacity: 0.7 }}>Refresh Token: {auth.user?.refresh_token?.substring(0, 20)}...</pre>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => auth.removeUser()}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    backgroundColor: 'var(--color-danger)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Sign out
                </button>
                <button 
                  onClick={() => signOutRedirect()}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    backgroundColor: 'var(--color-secondary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Sign out (Redirect)
                </button>
              </div>
            </div>
            
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
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => auth.signinRedirect()}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Sign in
          </button>
          <button 
            onClick={() => signOutRedirect()}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              backgroundColor: 'var(--color-secondary)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </Layout>
  );
}

export default App;
