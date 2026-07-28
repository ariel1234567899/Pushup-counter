const CACHE_NAME = 'push-up-tracker-v3';
const APP_SHELL = ['./', './index.html', './styles.css', './push-config.js', './app.js', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => { if (event.request.method !== 'GET') return; event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match('./index.html')))); });
self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: 'Push-Up Tracker', body: 'Time for your push-ups.' };
  event.waitUntil(self.registration.showNotification(data.title || 'Push-Up Tracker', { body: data.body || 'Time for your push-ups.', icon: './icons/icon-192.png', badge: './icons/icon-192.png', data: { url: './' } }));
});
self.addEventListener('notificationclick', (event) => { event.notification.close(); event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => windows[0] ? windows[0].focus() : clients.openWindow('./'))); });
