import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ToastProvider } from './components/ToastProvider';

function bootstrap() {
  const container = document.getElementById('root');
  if (!container) return;
  const root = createRoot(container);
  root.render(
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}

bootstrap();


