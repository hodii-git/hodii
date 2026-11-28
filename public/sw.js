/* Hodii service worker. Deliberately small: it makes the site installable, speeds up repeat visits by keeping
 * built assets, and shows a friendly page when there is no network. It never stores pages, accounts or API answers,
 * so nobody can be shown someone else's data or stale listings. Bump VERSION to drop old caches. */
const VERSION = "v3";
const PAGES = `hodii-pages-${VERSION}`;
// Personal or signed-in areas are never kept, so nobody can be shown someone else's data.
const PRIVATE = /^\/(dashboard|admin|auth|saved|notifications|account|api|_serverFn|logout|billing|pay)/;
const ASSETS = `hodii-assets-${VERSION}`;
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(ASSETS).then((c) => c.addAll([OFFLINE, "/icon-192.png", "/favicon.svg"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("hodii-") && k !== ASSETS && k !== PAGES).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
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
  // Fonts and images from our own origin: keep them so the app keeps its look offline.
  if (/\.(woff2?|ttf|css|js|svg|png|jpe?g|webp|avif|ico)$/i.test(url.pathname)) {
    e.respondWith(caches.open(ASSETS).then(async (c) => { const hit = await c.match(req); const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit); return hit || net; }));
    return;
  }
  // Pages: network first. A public page that loaded is kept, so offline it still opens with its full styling;
  // anything else (or private pages) falls back to the branded offline page.
  if (req.mode === "navigate") {
    const keep = !PRIVATE.test(url.pathname);
    e.respondWith(fetch(req).then((res) => { if (keep && res.ok && res.type === "basic") { const copy = res.clone(); caches.open(PAGES).then((c) => c.put(url.pathname + url.search, copy)); } return res; })
      .catch(async () => (keep && (await caches.open(PAGES).then((c) => c.match(url.pathname + url.search)))) || (keep && (await caches.open(PAGES).then((c) => c.match("/")))) || caches.match(OFFLINE)));
  }
});
