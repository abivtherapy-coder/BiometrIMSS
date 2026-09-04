const CACHE_NAME = "biometrimss-v4.6.1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=4.6.1",
  "./logic.js?v=4.6.1",
  "./report-image.js?v=4.6.1",
  "./app.js?v=4.6.1",
  "./manifest.webmanifest?v=4.6.1",
  "./icons/icon-180.png?v=4.6.1",
  "./icons/icon-192.png?v=4.6.1",
  "./icons/icon-512.png?v=4.6.1",
  "./icons/icon-maskable-512.png?v=4.6.1",
  "./assets/abisai-pase-entrada.png",
  "./assets/abisai-pase-salida.png",
  "./assets/abisai-vacaciones.png",
  "./assets/abit-ai-states-sticker-sheet-v1.png",
  "./assets/biometrimss-avatar-icon-v3.png",
  "./assets/biometrimss-logo-v1.png?v=4.6.1",
  "./vendor/pdfjs/pdf.min.mjs",
  "./vendor/pdfjs/pdf.worker.min.mjs",
  "./vendor/pdf-lib/pdf-lib.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
