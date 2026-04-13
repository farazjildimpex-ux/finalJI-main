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
  console.warn('Firebase not fully configured — FCM tokens disabled, local notifications still work.');
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

/**
 * Request notification permission (always) then attempt to get an FCM token.
 * Returns:
 *   null  — permission denied or unsupported browser
 *   ''    — permission granted but FCM token unavailable (Firebase not configured / SW error)
 *   token — fully working FCM token
 */
// Persist Firebase config to IndexedDB so firebase-messaging-sw.js can
// self-initialise on future SW activations (e.g. when a push arrives and
// the app is closed).
function persistConfigToIDB(config: object): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.open('jild-fcm', 1);
    req.onupgradeneeded = (e) => (e.target as IDBOpenDBRequest).result.createObjectStore('config');
    req.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      try {
        const tx = db.transaction('config', 'readwrite');
        tx.objectStore('config').put(config, 'firebaseConfig');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); resolve(); };
      } catch (_) { db.close(); resolve(); }
    };
    req.onerror = () => resolve();
  });
}

export async function requestNotificationPermission(): Promise<string | null> {
  if (!('Notification' in window)) return null;

  // Step 1: Ask the user for permission — this must happen first and is
  // independent of Firebase.  If this check is guarded by isFirebaseConfigured
  // the browser prompt never appears when Firebase vars are missing.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.log('Notification permission not granted:', permission);
    return null;
  }

  // Step 2: Try to get an FCM token.  Failure here is non-fatal — the user
  // has already granted permission so local notifications still work.
  if (!isFirebaseConfigured) {
    console.warn('Firebase not configured — skipping FCM token, local notifications active.');
    return '';
  }

  try {
    const msg = getFirebaseMessaging();
    if (!msg) return '';

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('VITE_FIREBASE_VAPID_KEY missing — skipping FCM token.');
      return '';
    }

    // Register the Firebase messaging SW and wait for it to become active.
    // navigator.serviceWorker.ready only tracks the page-controlling SW (sw.js),
    // NOT this scoped SW, so we must wait on its own state.
    let swReg: ServiceWorkerRegistration | undefined;
    try {
      swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/firebase-cloud-messaging-push-scope',
      });

      if (!swReg.active) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 8000);
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
        await new Promise(r => setTimeout(r, 400));
      }
    } catch (swErr) {
      console.warn('Firebase SW registration warning (continuing):', swErr);
    }

    const token = await getToken(msg, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });

    if (!token) console.warn('getToken returned empty — check VAPID key and Firebase project.');

    // Persist config so the SW can self-init on future activations
    await persistConfigToIDB(firebaseConfig);

    return token || '';
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return '';
  }
}

export function onForegroundMessage(callback: (payload: any) => void) {
  const msg = getFirebaseMessaging();
  if (!msg) return () => {};
  return onMessage(msg, callback);
}

export { getToken, onMessage };
