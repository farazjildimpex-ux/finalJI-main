importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Firebase config will be passed via the service worker registration message
// but we need to initialise it here for background message handling
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    if (!self.firebaseInitialised) {
      firebase.initializeApp(event.data.config);
      const messaging = firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        const title = payload.notification?.title || 'JILD IMPEX';
        const body = payload.notification?.body || '';
        const icon = '/icon-192.png';
        const badge = '/icon-192.png';
        self.registration.showNotification(title, {
          body,
          icon,
          badge,
          tag: payload.data?.tag || 'jild-notification',
          data: payload.data || {},
          requireInteraction: false,
          actions: [
            { action: 'open', title: 'Open App' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        });
      });
      self.firebaseInitialised = true;
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/app/home';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
