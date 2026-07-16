import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, BaseStyles } from '@primer/react';
import App from './App';

const root = document.getElementById('root')!;

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider>
      <BaseStyles>
        <App />
      </BaseStyles>
    </ThemeProvider>
  </React.StrictMode>,
);
