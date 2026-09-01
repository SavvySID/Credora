import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProviders } from './providers/AppProviders';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            // Theme variables live on <html>, so toasts follow light/dark for free.
            style: {
              background: 'rgb(var(--surface))',
              color: 'rgb(var(--ink))',
              border: '1px solid rgb(var(--hairline))',
              borderRadius: '12px',
              boxShadow:
                '0 8px 12px -6px rgb(var(--shadow-color) / var(--shadow-a2)), 0 24px 56px -20px rgb(var(--shadow-color) / var(--shadow-a4))',
              fontSize: '14px',
              fontWeight: 500,
              padding: '12px 14px',
            },
            success: {
              iconTheme: { primary: 'rgb(var(--positive-500))', secondary: 'rgb(var(--surface))' },
            },
            error: {
              iconTheme: { primary: 'rgb(var(--critical-500))', secondary: 'rgb(var(--surface))' },
            },
          }}
        />
      </BrowserRouter>
    </AppProviders>
  </React.StrictMode>,
);
