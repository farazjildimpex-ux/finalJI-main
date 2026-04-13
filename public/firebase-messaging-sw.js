importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Read Firebase config from IndexedDB (stored by main app on first enable)
function getConfigFromIDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open('jild-fcm', 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore('config');
    req.onsuccess = (e) => {
      const db = e.target.result;
      try {
        const tx = db.transaction('config', 'readonly');
        const get = tx.objectStore('config').get('firebaseConfig');
        get.onsuccess = () => { db.close(); resolve(get.result || null); };
        get.onerror = () => { db.close(); resolve(null); };
      } catch (_) { db.close(); resolve(null); }
    };
    req.onerror = () => resolve(null);
  });
}

function setupFirebase(config) {
  if (self.firebaseInitialised) return;
  try {
    firebase.initializeApp(config);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title || 'JILD IMPEX';
      const body = payload.notification?.body || '';
      const targetUrl = payload.data?.url || payload.fcmOptions?.link || '/app/journal';
      self.registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: payload.data?.tag || 'jild-notification',
        data: { url: targetUrl, ...payload.data },
        requireInteraction: false,
      });
    });
    self.firebaseInitialised = true;
  } catch (e) {
    console.error('[FCM SW] Firebase init error:', e);
  }
}

// On SW activation, read saved config from IDB and initialise Firebase.
// This handles the case where a push arrives when the app is closed.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    getConfigFromIDB().then((config) => {
      if (config) setupFirebase(config);
    })
  );
});

// Also initialise when the main app sends the config during the enable flow.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG' && !self.firebaseInitialised) {
    setupFirebase(event.data.config);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/app/journal';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('navigate' in client && 'focus' in client) {
          return client.navigate(targetUrl).then((c) => (c ? c.focus() : client.focus()));
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
