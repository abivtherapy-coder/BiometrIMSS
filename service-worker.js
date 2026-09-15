const CACHE_NAME = "biometrimss-v4.9.0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=4.9.0",
  "./themes/monthly-theme.css?v=4.9.0",
  "./themes/monthly-theme.js?v=4.9.0",
  "./logic.js?v=4.9.0",
  "./report-image.js?v=4.9.0",
  "./app.js?v=4.9.0",
  "./manifest.webmanifest?v=4.9.0",
  "./icons/icon-180.png?v=4.9.0",
  "./icons/icon-192.png?v=4.9.0",
  "./icons/icon-512.png?v=4.9.0",
  "./icons/icon-maskable-512.png?v=4.9.0",
  "./assets/abisai-pase-entrada.png",
  "./assets/abisai-pase-salida.png",
  "./assets/abisai-vacaciones.png",
  "./assets/abit-ai-states-sticker-sheet-v1.png",
  "./assets/biometrimss-avatar-icon-v3.png",
  "./assets/biometrimss-logo-transparent-v1.png?v=4.9.0",
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

  // El generador visual cambia con frecuencia: red primero para evitar informes viejos en la PWA.
  if (url.pathname.endsWith("/report-image.js")) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        return response;
      }).catch(() => caches.match(event.request))
    );
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
