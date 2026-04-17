/* Finance AI — Service Worker
 * Cache-first para assets próprios; network-first para CDNs. */
const CACHE = "finance-ai-v3.3";
const LOCAL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./storage.js",
  "./ai_engine.js",
  "./app.js",
  "./notifications.js",
  "./cloud_sync.js",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(LOCAL_ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Só GET
  if (e.request.method !== "GET") return;
  // CDN externa → network-first com fallback cache
  if (url.origin !== self.location.origin) {
    e.respondWith(
      fetch(e.request).then(res => {
        const cp = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Local → cache-first
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        const cp = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp)).catch(() => {});
        return res;
      })
    )
  );
});
