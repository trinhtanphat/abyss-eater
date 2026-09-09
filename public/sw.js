const CACHE_NAME = 'abyss-eater-shell-v7';
const SHELL = [
  '/',
  '/styles.css',
  '/themes.css',
  '/integration.css',
  '/bootstrap.js',
  '/app.js',
  '/client-input.mjs',
  '/client-settings.mjs',
  '/client-audio.mjs',
  '/client-tts.mjs',
  '/client-progression.mjs',
  '/client-capabilities.mjs',
  '/game/config.js',
  '/game/effects.js',
  '/game/environment.js',
  '/game/fish.js',
  '/game/fish-evolution.mjs',
  '/game/skins.js',
  '/game/input.js',
  '/game/network.js',
  '/game/presentation.js',
  '/game/scene.js',
  '/game/state.js',
  '/game/themes.js',
  '/ui/hud.js',
  '/ui/lobby.js',
  '/ui/toast.js',
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })),
  );
});
