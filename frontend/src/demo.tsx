import React from 'react';
import ReactDOM from 'react-dom/client';
import VocabularyManagementDemo from './VocabularyManagementDemo';
import './styles/globals.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <VocabularyManagementDemo />
  </React.StrictMode>
);