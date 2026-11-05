/* AeroApp learner service worker — makes /app work fully offline.
 *  - install: pre-caches the app shell (HTML), every JS/CSS/font chunk of the learner build, icons, the bundled pack
 *  - /build/*        : cache-first (content-hashed, immutable)
 *  - navigations     : network-first (6 s), falling back to the cached shell — every /app route is the same SPA
 *  - media (/storage, /media, mp4/glb/mp3): served from the media cache with HTTP Range support (Safari needs 206)
 *  - /api/*          : never cached here — the app keeps its own offline copy in IndexedDB
 * VERSION and PRECACHE are injected by Laravel (routes/web.php → /sw.js) from the current build manifest,
 * so every deploy produces a byte-different worker and the browser installs the update.
 */
/* global VERSION, PRECACHE */
const SHELL = `aeroapp-shell-${VERSION}`;
const STATIC = `aeroapp-static-${VERSION}`;
const MEDIA = 'aeroapp-media'; // filled by the pack installer; survives app updates

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    const statics = await caches.open(STATIC);
    await shell.add(new Request('/app', { credentials: 'same-origin', cache: 'reload' })).catch(() => {});
    await Promise.all(PRECACHE.map((u) => (u.startsWith('/build/') ? statics : shell).add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('aeroapp-') && k !== SHELL && k !== STATIC && k !== MEDIA) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function rangeResponse(request, response) {
  const range = request.headers.get('range');
  if (!range || !response) return response;
  const buf = await response.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  const start = m && m[1] ? parseInt(m[1], 10) : 0;
  const end = m && m[2] ? Math.min(parseInt(m[2], 10), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Media referenced by installed packs (any origin): offline copy first, with range support.
  if (/\.(mp4|webm|m4a|mp3|glb)(\?|$)/i.test(url.pathname + url.search) || url.pathname.startsWith('/storage/')) {
    event.respondWith((async () => {
      const media = await caches.open(MEDIA);
      const hit = (await media.match(url.href)) || (await media.match(url.pathname)) || (await caches.match(url.pathname));
      if (hit) return rangeResponse(req, hit);
      return fetch(req);
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/build/')) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  if (req.mode === 'navigate') {
    if (!url.pathname.startsWith('/app')) return; // admin and sign-in pages are online-only
    event.respondWith((async () => {
      const shell = await caches.open(SHELL);
      try {
        const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]);
        if (res.ok) shell.put('/app', res.clone());
        return res;
      } catch {
        return (await shell.match('/app')) || new Response('<h1>Offline</h1><p>Open AeroApp once while online to install it.</p>', { status: 503, headers: { 'Content-Type': 'text/html' } });
      }
    })());
    return;
  }

  // Other same-origin GETs (icons, manifest, bundled packs): stale-while-revalidate.
  event.respondWith((async () => {
    const shell = await caches.open(SHELL);
    const hit = await shell.match(req);
    const net = fetch(req).then((res) => { if (res.ok) shell.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
