import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { QueryProvider } from './app/providers/QueryProvider.jsx';
import { ThemeProvider } from './app/providers/ThemeProvider.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="fishing-journal-theme">
      <QueryProvider>
        <App />
      </QueryProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
