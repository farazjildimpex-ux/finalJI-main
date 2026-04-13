import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if all required Firebase config values are present
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId &&
  firebaseConfig.messagingSenderId
);

let app: FirebaseApp | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
} else {
  console.warn('Firebase is not configured. Push notifications will be disabled. Please add VITE_FIREBASE_PROJECT_ID and other Firebase variables to your .env file.');
}

export const firebaseApp = app;

let messaging: Messaging | null = null;

export function getFirebaseMessaging(): Messaging | null {
  if (!isFirebaseConfigured || typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;
  
  try {
    if (!messaging && firebaseApp) {
      messaging = getMessaging(firebaseApp);
    }
  } catch (error) {
    console.error('Error getting Firebase Messaging:', error);
    return null;
  }
  return messaging;
}

export async function requestNotificationPermission(): Promise<string | null> {
  if (!isFirebaseConfigured) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    const msg = getFirebaseMessaging();
    if (!msg) return null;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('VITE_FIREBASE_VAPID_KEY is missing');
      return null;
    }

    // Register firebase messaging SW and wait for it to become active
    let swReg: ServiceWorkerRegistration | undefined;
    try {
      swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/firebase-cloud-messaging-push-scope' });

      // Wait for THIS specific SW to be active (not the main sw.js)
      if (!swReg.active) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 6000);
          const sw = swReg!.installing || swReg!.waiting;
          if (!sw) { clearTimeout(timeout); resolve(); return; }
          sw.addEventListener('statechange', function handler() {
            if (sw.state === 'activated' || sw.state === 'redundant') {
              clearTimeout(timeout);
              sw.removeEventListener('statechange', handler);
              resolve();
            }
          });
        });
      }

      const activeSw = swReg.active;
      if (activeSw) {
        activeSw.postMessage({ type: 'FIREBASE_CONFIG', config: firebaseConfig });
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (swErr) {
      console.warn('Firebase SW registration warning:', swErr);
    }

    const token = await getToken(msg, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });
    return token;
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: any) => void) {
  const msg = getFirebaseMessaging();
  if (!msg) return () => {};
  return onMessage(msg, callback);
}

export { getToken, onMessage };