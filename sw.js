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
  const debugInfo = {};
  debugInfo.contentType = request.headers.get('content-type');
  debugInfo.contentLength = request.headers.get('content-length');
  try {
    // Dos clones independientes del mismo cuerpo sin leer todavía:
    // uno para medir bytes crudos, otro para el parser de formulario.
    const reqForBytes = request.clone();
    const reqForForm = request.clone();

    try {
      const buf = await reqForBytes.arrayBuffer();
      debugInfo.bodyByteLength = buf.byteLength;
    } catch (e) {
      debugInfo.bodyReadError = String((e && e.message) || e);
    }

    const formData = await reqForForm.formData();
    debugInfo.keys = Array.from(formData.keys());
    let file = formData.get('sharedFile');
    if (!file || typeof file === 'string') {
      // Por si Android/WhatsApp no usó exactamente el nombre de campo declarado:
      // buscamos cualquier entrada que sea un archivo real.
      for (const [k, v] of formData.entries()) {
        if (v && typeof v !== 'string') { file = v; debugInfo.foundUnderKey = k; break; }
      }
    }
    if (file && typeof file !== 'string') {
      debugInfo.fileName = file.name;
      debugInfo.fileType = file.type;
      debugInfo.fileSize = file.size;
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(SHARE_URL, new Response(file, {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name || 'compartido.xlsx')
        }
      }));
      debugInfo.saved = true;
    } else {
      debugInfo.saved = false;
      debugInfo.error = 'No se encontró ningún archivo en los datos recibidos.';
    }
  } catch (err) {
    debugInfo.error = String((err && err.message) || err);
  }
  try {
    const cache = await caches.open(SHARE_CACHE);
    await cache.put(SHARE_URL + '__debug', new Response(JSON.stringify(debugInfo, null, 2)));
  } catch (e) { /* si esto también falla, no hay mucho más que hacer */ }
  const dest = new URL('./index.html?shared=1', url);
  return Response.redirect(dest.href, 303);
}
