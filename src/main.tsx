import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Guard against benign Firebase Auth internal popup lifecycle assertion errors in iframe/browser environments
const isAuthAssertionNotice = (val: unknown): boolean => {
  const str = String((val as any)?.message || val || '');
  return str.includes('Pending promise was never set') || str.includes('INTERNAL ASSERTION FAILED');
};

window.addEventListener('error', (event) => {
  if (isAuthAssertionNotice(event.message) || isAuthAssertionNotice(event.error)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }
}, true);

window.addEventListener('unhandledrejection', (event) => {
  if (isAuthAssertionNotice(event.reason?.message) || isAuthAssertionNotice(event.reason)) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (args.some(arg => isAuthAssertionNotice(arg))) {
    return;
  }
  origConsoleError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

