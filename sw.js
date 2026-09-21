// Service worker de Marzocca — Gastos.
// Su único trabajo real es interceptar el POST que Android genera cuando el usuario
// comparte un archivo desde otra app (ej. WhatsApp) hacia esta PWA, guardarlo en
// IndexedDB, y redirigir a la app para que lo procese. No cachea nada más:
// el resto de la app sigue funcionando 100% online/offline como ya lo hacía.

const DB_NAME = 'vetGastosMarzoccaDB';
const DB_STORE = 'kv';
const SHARE_KEY = 'pending-share';

self.addEventListener('install', () => {
  self.skipWaiting();
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
      const bytes = await file.arrayBuffer();
      const db = await openDB();
      await idbPut(db, SHARE_KEY, {
        name: file.name || 'compartido.xlsx',
        type: file.type || '',
        bytes,
        ts: Date.now()
      });
    }
  } catch (err) {
    // Si algo falla, igual redirigimos: la app mostrará el aviso correspondiente.
    console.error('Error procesando archivo compartido', err);
  }
  const dest = new URL('./index.html?shared=1', url);
  return Response.redirect(dest.href, 303);
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DB_STORE)) {
        req.result.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
