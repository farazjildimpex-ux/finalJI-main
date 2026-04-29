// JILD IMPEX service worker.
// Strategy:
//   - HTML navigations  → network-first, fall back to cached shell only when offline.
//   - Hashed JS/CSS     → cache-first (immutable, content-hashed by Vite).
//   - Other static      → stale-while-revalidate.
// Pre-caching `/index.html` is intentionally avoided — its <script> tags point
// at hashed bundles that disappear on every deploy, which is what caused the
// installed PWA to launch into a blank screen after each Netlify build.

const APP_VERSION = 'v10-2026-04-29';
const STATIC_CACHE = `jild-static-${APP_VERSION}`;
const RUNTIME_CACHE = `jild-runtime-${APP_VERSION}`;

const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

const SKIP_HOSTS = [
  'supabase.co',
  'googleapis.com',
  'firebaseio.com',
  'fcm.googleapis.com',
  'openrouter.ai',
  'generativelanguage.googleapis.com',
];
const SKIP_PATHS = ['/api/', '/.netlify/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((n) => n !== STATIC_CACHE && n !== RUNTIME_CACHE)
          .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

function shouldBypass(url) {
  if (SKIP_HOSTS.some((h) => url.hostname.includes(h))) return true;
  if (SKIP_PATHS.some((p) => url.pathname.startsWith(p))) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // Don't intercept cross-origin or API/auth traffic.
  if (url.origin !== self.location.origin) return;
  if (shouldBypass(url)) return;

  const accept = req.headers.get('accept') || '';
  const isHtml = req.mode === 'navigate' || accept.includes('text/html');

  // ── HTML pages ── network-first, never serve a stale shell when online.
  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Save a fresh copy so offline launches still boot the SPA shell.
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put('/index.html', clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html', { cacheName: RUNTIME_CACHE });
          if (cached) return cached;
          return new Response(
            '<!doctype html><html><head><meta charset="utf-8"><title>Offline</title>' +
            '<meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<style>body{font-family:-apple-system,sans-serif;padding:2rem;text-align:center;color:#334155}</style>' +
            '</head><body><h2>You\'re offline</h2>' +
            '<p>Reconnect and reopen JILD IMPEX.</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // ── Vite hashed bundles ── cache-first (immutable filenames).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        });
        // Note: no HTML fallback here — returning HTML for a failed JS
        // request causes a parse error and a blank screen.
      })
    );
    return;
  }

  // ── Other static (icons, manifest, fonts) ── stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// ── Push notifications (unchanged) ─────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { notification: { title: 'JILD IMPEX', body: event.data.text() } }; }

  const title = data.notification?.title || 'JILD IMPEX';
  const targetUrl = data.data?.url || data.fcmOptions?.link || '/app/journal';
  const options = {
    body: data.notification?.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.data?.tag || 'jild-notification',
    data: { url: targetUrl, ...data.data },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/app/journal';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('navigate' in client && 'focus' in client) {
          return client.navigate(targetUrl).then((c) => c ? c.focus() : client.focus());
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
