import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import ImageProcessingApp from './App';

// React 18の新しいrootAPIを使用
const root = ReactDOM.createRoot(document.getElementById('root'));

// StrictModeで開発時の問題を早期発見
root.render(
  <React.StrictMode>
    <ImageProcessingApp />
  </React.StrictMode>
);
