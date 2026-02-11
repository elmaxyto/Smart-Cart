const CACHE_NAME = 'smartcart-v3';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './src/utils.js',
  './src/category-manager.js',
  './src/components.js',
  './src/hooks/useToast.js',
  './src/hooks/useSpeechToText.js',
  './src/App.js',
  './assets/suggestions.json',
  './assets/icons/cart-icon.svg',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const isHttp = event.request.url.startsWith('http');
          if (!isHttp || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
