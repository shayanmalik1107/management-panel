/* LAMBA app-shell cache. Business records remain in IndexedDB, not this cache. */
const CACHE_NAME = 'lamba-app-shell-v1';
const APP_SHELL = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest', '/lambalogo.png', '/lamba.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL.map((path) => new Request(path, { cache: 'reload' })));
    // Pre-cache the hashed Vite entry JS/CSS on the first successful install.
    const html = await fetch('/index.html', { cache: 'reload' });
    if (html.ok) {
      const markup = await html.clone().text();
      await cache.put('/index.html', html);
      const assets = [...markup.matchAll(/(?:src|href)=\"([^\"]+\.(?:js|css))\"/g)].map((match) => match[1]);
      await Promise.all(assets.map(async (asset) => {
        try { const response = await fetch(asset, { cache: 'reload' }); if (response.ok) await cache.put(asset, response); } catch (_) {}
      }));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('lamba-app-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.includes('__/auth')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(CACHE_NAME)).put('/index.html', response.clone());
        return response;
      } catch (_) {
        return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  // Vite's hashed JS/CSS and public static assets are cached on first visit.
  if (url.pathname.startsWith('/assets/') || /\.(?:js|css|svg|png|jpg|jpeg|webp|webmanifest|woff2?)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
        fetch(request).then((response) => { if (response.ok) cache.put(request, response); }).catch(() => {});
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch (_) {
        return Response.error();
      }
    })());
  }
});
