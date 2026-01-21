import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { SidebarProvider } from './context/SidebarContext';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <SidebarProvider>
          <App />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'var(--color-app-card)',
                color: 'var(--color-app-text)',
                border: '1px solid var(--color-app-border)',
              },
              success: {
                iconTheme: {
                  primary: '#22c55e',
                  secondary: 'var(--color-app-card)',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: 'var(--color-app-card)',
                },
              },
            }}
          />
        </SidebarProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
