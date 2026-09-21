// Service worker de Marzocca — Gastos (v2).
// Su único trabajo real es interceptar el POST que Android genera cuando el usuario
// comparte un archivo desde otra app (ej. WhatsApp) hacia esta PWA, guardarlo
// temporalmente en Cache Storage, y redirigir a la app para que lo procese.
// No cachea nada más: el resto de la app sigue funcionando online como ya lo hacía.
//
// v2: se cambió el mecanismo de IndexedDB a Cache Storage (más simple y estándar
// para este caso puntual) y se fuerza a reemplazar cualquier versión anterior
// de este archivo que el teléfono haya guardado.

const SHARE_CACHE = 'marzocca-share-v2';
const SHARE_URL = './__shared-file__';

self.addEventListener('install', () => {
  self.skipWaiting(); // reemplaza cualquier SW anterior sin esperar a que se cierren pestañas
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target.html')) {
    event.respondWith(handleShareTarget(event.request, url));
  }
});

async function handleShareTarget(request, url) {
  try {
    const formData = await request.formData();
    const file = formData.get('sharedFile');
    if (file) {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(SHARE_URL, new Response(file, {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name || 'compartido.xlsx')
        }
      }));
    }
  } catch (err) {
    // Si algo falla igual redirigimos: la app va a abrir normalmente.
    console.error('Error procesando archivo compartido', err);
  }
  const dest = new URL('./index.html?shared=1', url);
  return Response.redirect(dest.href, 303);
}
