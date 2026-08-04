/* Ankaufsbuch — Offline-Cache.
   Programmdateien werden zuerst frisch geholt und nur bei fehlendem Netz
   aus dem Cache bedient. Deine Daten liegen NICHT hier, sondern in IndexedDB. */
const CACHE = "ankaufsbuch-v8";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => {
  if (e.data === "update") self.registration.update();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const istProgramm = req.mode === "navigate"
    || url.pathname.endsWith("/")
    || url.pathname.endsWith("index.html")
    || url.pathname.endsWith("manifest.webmanifest");

  if (istProgramm) {
    // Erst das Netz fragen, Cache nur als Rückfallebene
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  // Icons und Sonstiges: Cache zuerst, das ändert sich selten
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
