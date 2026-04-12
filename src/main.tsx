import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initPWA } from './utils/pwaHelper.ts';

initPWA();

// Register Firebase messaging service worker for background push notifications
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
    .then((reg) => {
      // Pass Firebase config to the service worker
      const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      };
      if (reg.active) {
        reg.active.postMessage({ type: 'FIREBASE_CONFIG', config: firebaseConfig });
      } else if (reg.installing) {
        reg.installing.addEventListener('statechange', () => {
          if (reg.active) reg.active.postMessage({ type: 'FIREBASE_CONFIG', config: firebaseConfig });
        });
      }
    })
    .catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
