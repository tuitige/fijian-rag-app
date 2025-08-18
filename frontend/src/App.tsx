import React from 'react';
import Layout from './components/Layout/Layout';
import { ChatContainer } from './components/Chat';
import './styles/globals.css';

function App() {
  return (
    <Layout>
      <ChatContainer />
    </Layout>
  );
}

export default App;
