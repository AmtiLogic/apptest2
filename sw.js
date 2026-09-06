// sw.js
// Keeps the app working with no network, and keeps it up to date.
//
// Strategy is network first with a cache fallback. When there is a working
// connection the app always loads whatever was last deployed, so a push to
// GitHub Pages reaches an installed Home Screen app on its next launch with
// nothing to clear by hand. When there is no connection, or the network is
// too slow to be useful, the cached copy is served instead.

const CACHE_NAME = 'holdem-coach-v8';

// How long to wait for the network before falling back to the cache. Short,
// because every file here is small and a stale table beats a blank screen.
const NETWORK_TIMEOUT = 3500;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/ui.js',
  './js/engine.js',
  './js/cards.js',
  './js/bots.js',
  './js/coach.js',
  './js/glossary.js',
  './js/live.js',
  './js/diagrams.js',
  './js/replay.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT);
    if (response && response.ok && response.type === 'basic') {
      // Store the fresh copy for the next time there is no connection.
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    // A cold navigation with no network and nothing cached for this exact
    // address still gets the app shell.
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('network timeout')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

// The page asks for this when it comes back to the foreground.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
