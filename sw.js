'use strict';

/* =====================================================================
   Zas — service worker.

   Dos estrategias según lo que se pida:

   · El código de la app (html, js, css) se pide SIEMPRE a la red primero.
     Así, quien tenga la PWA instalada recibe los arreglos sin esperar a
     que alguien se acuerde de subir el número de versión. La caché queda
     de red de seguridad para cuando no hay cobertura.

   · Los iconos van de la caché, que no cambian nunca.

   Aquí no entra ni un dato tuyo: el service worker solo sirve archivos.
   ===================================================================== */

const VERSION = 'v1';
const CACHE = `zas-${VERSION}`;

const ARCHIVOS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './js/calc.js',
  './js/state.js',
  './js/ui.js',
  './js/render.js',
  './js/captura.js',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

const esCodigo = (url) =>
  url.pathname.endsWith('.html') ||
  url.pathname.endsWith('.js') ||
  url.pathname.endsWith('.css') ||
  url.pathname.endsWith('.webmanifest') ||
  url.pathname.endsWith('/');

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      /* Un archivo que falle no puede tumbar toda la instalación */
      Promise.allSettled(ARCHIVOS.map((a) => c.add(a)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) =>
        /* Solo las nuestras. Si Zas comparte dominio con otra app (otro
           proyecto en el mismo usuario.github.io, por ejemplo), sus cachés
           no son asunto de Zas: borrarlas le quitaría el modo sin conexión. */
        Promise.all(
          claves
            .filter((k) => k.startsWith('zas-') && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (esCodigo(url)) {
    e.respondWith(redPrimero(request));
  } else {
    e.respondWith(cachePrimero(request));
  }
});

async function redPrimero(request) {
  try {
    const res = await fetch(request);
    /* Solo guardamos respuestas buenas: un 404 cacheado es un 404 eterno */
    if (res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch (e) {
    const guardada = await caches.match(request);
    if (guardada) return guardada;

    /* Sin red y sin copia: al menos que la navegación caiga en la portada */
    if (request.mode === 'navigate') {
      const portada = await caches.match('./index.html');
      if (portada) return portada;
    }
    throw e;
  }
}

async function cachePrimero(request) {
  const guardada = await caches.match(request);
  if (guardada) return guardada;

  const res = await fetch(request);
  if (res.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, res.clone());
  }
  return res;
}
