import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './styles/global.css';

// ============================================================
// FILTRO DE WARNINGS DO CONSOLE
// ============================================================

// Salva a referência original
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Filtra warnings específicos
console.warn = function(...args) {
  const message = args[0]?.toString() || '';
  
  // Ignora warnings do LiveKit que são esperados
  if (
    message.includes('DATA_TRACK_LOSSY') ||
    message.includes('publisher data channel') ||
    message.includes('closed unexpectedly')
  ) {
    return; // Silencia silenciosamente
  }
  
  // Ignora warnings de CORS do dlnk.one (extensões)
  if (
    message.includes('dlnk.one') ||
    message.includes('CORS policy')
  ) {
    return;
  }
  
  // Mantém os outros warnings
  originalConsoleWarn.apply(console, args);
};

// Filtra erros específicos (opcional)
console.error = function(...args) {
  const message = args[0]?.toString() || '';
  
  // Ignora erros do dlnk.one (extensões)
  if (
    message.includes('dlnk.one') ||
    message.includes('ERR_FAILED')
  ) {
    return;
  }
  
  originalConsoleError.apply(console, args);
};

// ============================================================
// RENDERIZAÇÃO DA APLICAÇÃO
// ============================================================

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);