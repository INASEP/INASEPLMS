/* ═══════════════════════════════════════════════
   INASEP — Service Worker PWA
   Estrategia: Network-first con fallback a caché.
   Los datos de Firebase siempre van a la red;
   solo se cachean los recursos estáticos del shell.
═══════════════════════════════════════════════ */

const CACHE_NAME = 'inasep-shell-v1';

/* Recursos estáticos que se pre-cachean al instalar */
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  /* CDN externos — se cachean en primer uso (ver fetch handler) */
];

/* ── Instalación: pre-cachear el shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

/* ── Activación: limpiar cachés viejas ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch: network-first para Firebase, cache-first para estáticos ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Nunca interceptar Firebase/Firestore — siempre van a la red */
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    return; /* dejar pasar sin interceptar */
  }

  /* Para el resto: intentar red, caer en caché si falla */
  event.respondWith(
    fetch(event.request)
      .then(response => {
        /* Si la respuesta es válida, guardarla en caché */
        if (response && response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
