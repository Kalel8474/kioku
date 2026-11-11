import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);

// Offline support when served over http(s) with a sw.js next to index.html (not in single-file builds).
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && document.querySelector('meta[name="kioku-sw"]')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
