const CACHE_NAME = 'jild-impex-v6';
const RUNTIME_CACHE = 'jild-impex-runtime-v6';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

const SKIP_CACHE_URLS = [
  'supabase.co',
  'googleapis.com',
  'firebaseio.com',
  'fcm.googleapis.com',
  'api/',
  'functions/'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('SW: Some assets failed to cache', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

function shouldSkipCache(url) {
  return SKIP_CACHE_URLS.some(skipUrl => url.includes(skipUrl));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || shouldSkipCache(url.href)) {
    return;
  }

  if (request.url.includes('/assets/') || request.url.endsWith('.js') || request.url.endsWith('.css')) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) return response;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        });
      }).catch(() => caches.match('/index.html'))
    );
  } else {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type !== 'error') {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((response) => {
            return response || caches.match('/index.html');
          });
        })
    );
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { notification: { title: 'JILD IMPEX', body: event.data.text() } }; }

  const title = data.notification?.title || 'JILD IMPEX';
  const options = {
    body: data.notification?.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.data?.tag || 'jild-notification',
    data: data.data || {},
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
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

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(Promise.resolve());
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
