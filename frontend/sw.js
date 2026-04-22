/* Finance AI — Service Worker
 * Network-first para assets próprios (garante deploys imediatos);
 * network-first também para CDNs, com fallback offline via cache. */
const CACHE = "finance-ai-v3.9.5";
const LOCAL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./storage.js",
  "./fx.js",
  "./ai_engine.js",
  "./llm.js",
  "./automations.js",
  "./irpf_calc.js",
  "./csv_parser.js",
  "./bot.js",
  "./app.js",
  "./notifications.js",
  "./cloud_sync.js",
  "./market_monitor.js",
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
  // Local → network-first (garante que deploys novos cheguem)
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const cp = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
