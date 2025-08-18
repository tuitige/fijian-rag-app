import React from 'react';
import Layout from './components/Layout/Layout';
import { ChatContainer } from './components/Chat';
import { ChatModeProvider } from './contexts/ChatModeContext';
import './styles/globals.css';

function App() {
  return (
    <ChatModeProvider>
      <Layout>
        <ChatContainer />
      </Layout>
    </ChatModeProvider>
  );
}

export default App;
