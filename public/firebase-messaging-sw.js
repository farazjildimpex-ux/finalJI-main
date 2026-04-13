importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    if (!self.firebaseInitialised) {
      firebase.initializeApp(event.data.config);
      const messaging = firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        const title = payload.notification?.title || 'JILD IMPEX';
        const body = payload.notification?.body || '';
        // Store the target URL in data so notificationclick can use it
        const targetUrl = payload.data?.url || payload.fcmOptions?.link || '/app/journal';

        self.registration.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: payload.data?.tag || 'jild-notification',
          data: { url: targetUrl, ...payload.data },
          requireInteraction: false,
          // No actions — avoids Chrome showing the native "Unsubscribe" row
        });
      });
      self.firebaseInitialised = true;
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/app/journal';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If PWA / browser window is already open, navigate it to the target
      for (const client of clientList) {
        if ('navigate' in client && 'focus' in client) {
          return client.navigate(targetUrl).then((c) => c ? c.focus() : client.focus());
        }
      }
      // Otherwise open a fresh window
      return clients.openWindow(targetUrl);
    })
  );
});
