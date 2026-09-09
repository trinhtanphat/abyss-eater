const CACHE_NAME = 'abyss-eater-shell-v8';
const SHELL = [
  '/',
  '/styles.css',
  '/themes.css',
  '/integration.css',
  '/hud-assets.css',
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
  '/game/fish-skins.mjs',
  '/game/input.js',
  '/game/network.js',
  '/game/presentation.js',
  '/game/scene.js',
  '/game/state.js',
  '/game/themes.js',
  '/ui/hud.js',
  '/ui/lobby.js',
  '/ui/toast.js',
  '/assets/brand/abyss-eater-mark.svg',
  '/assets/ui/icons/mass.svg',
  '/assets/ui/icons/crown.svg',
  '/assets/ui/icons/skull.svg',
  '/assets/ui/icons/jaw.svg',
  '/assets/ui/icons/evolution.svg',
  '/assets/ui/icons/depth.svg',
  '/assets/ui/icons/settings.svg',
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
