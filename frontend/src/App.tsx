import React from 'react';
import Layout from './components/Layout/Layout';
import { ChatContainer } from './components/Chat';
import { Auth, ProtectedRoute } from './components/Auth';
import { UserProfile } from './components/Profile';
import { ChatModeProvider } from './contexts/ChatModeContext';
import { AuthProvider } from './contexts/AuthContext';
import { UserProgressProvider } from './contexts/UserProgressContext';
import { useAuth } from './contexts/AuthContext';
import './styles/globals.css';

const AuthenticatedApp: React.FC = () => {
  const { user } = useAuth();

  return (
    <UserProgressProvider>
      <ChatModeProvider>
        <Layout>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {user && <UserProfile />}
            <ChatContainer />
          </div>
        </Layout>
      </ChatModeProvider>
    </UserProgressProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <ProtectedRoute fallback={<Auth />}>
        <AuthenticatedApp />
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;
