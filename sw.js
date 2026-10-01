const CACHE = 'hakhamanesh21-cachefirst-v20';
const FALLBACK_CACHES = ['hakhamanesh21-cachefirst-v19','hakhamanesh21-offline-v18'];
const APP_SHELL = [
  './', './index.html', './style.css', './app.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './building.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Cache each file independently so one transient network failure does not break installation.
    await Promise.allSettled(APP_SHELL.map(async p => {
      const r = await fetch(p, {cache:'reload'});
      if (r.ok) await cache.put(p, r.clone());
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Keep v18 as an emergency fallback until v19 has taken control.
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && !FALLBACK_CACHES.includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function cachedFirst(req, navigation=false) {
  const current = await caches.open(CACHE);
  let hit;
  if (navigation) {
    hit = await current.match('./index.html', {ignoreSearch:true});
  } else {
    hit = await current.match(req, {ignoreSearch:true});
  }
  if (hit) return hit;

  // Emergency fallback to the previous offline cache.
  for (const name of FALLBACK_CACHES) {
    const c = await caches.open(name);
    const old = navigation
      ? await c.match('./index.html', {ignoreSearch:true})
      : await c.match(req, {ignoreSearch:true});
    if (old) {
      // Promote old cached response into v19 for subsequent launches.
      try { await current.put(navigation ? './index.html' : req, old.clone()); } catch (_) {}
      return old;
    }
  }

  // Network is only a fallback. A blocked workers.dev connection can no longer hold up a cached launch.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    const response = await fetch(req, {signal:controller.signal});
    clearTimeout(timer);
    if (response && response.ok) {
      try { await current.put(navigation ? './index.html' : req, response.clone()); } catch (_) {}
    }
    return response;
  } catch (_) {
    if (navigation) {
      return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body dir="rtl" style="font-family:sans-serif;padding:24px"><h2>ساختمان هخامنش ۲۱</h2><p>نسخه آفلاین هنوز کامل روی گوشی ذخیره نشده است. یک‌بار نسخه جدید را با اتصال قابل دسترس باز کنید.</p></body>', {headers:{'Content-Type':'text/html; charset=utf-8'}});
    }
    return new Response('', {status:504, statusText:'Offline'});
  }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(cachedFirst(req, req.mode === 'navigate'));
});
