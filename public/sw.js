/* Hodii service worker. Deliberately small: it makes the site installable, speeds up repeat visits by keeping
 * built assets, and shows a friendly page when there is no network. It never stores pages, accounts or API answers,
 * so nobody can be shown someone else's data or stale listings. Bump VERSION to drop old caches. */
const VERSION = "v1";
const ASSETS = `hodii-assets-${VERSION}`;
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(ASSETS).then((c) => c.addAll([OFFLINE, "/icon-192.png", "/favicon.svg"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("hodii-") && k !== ASSETS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Built files have a hash in their name, so they never change: keep them.
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.open(ASSETS).then(async (c) => { const hit = await c.match(req); if (hit) return hit; const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }));
    return;
  }
  // Pages: always from the network; only when that fails, the offline page.
  if (req.mode === "navigate") e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
});
