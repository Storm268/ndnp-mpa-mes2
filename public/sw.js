// NDNP MPA-MES Service Worker v2
// • Offline caching (app shell, map tiles, static assets)
// • Background Sync for queued incident reports

const CACHE_VERSION = 'v2'
const STATIC_CACHE  = `ndnp-static-${CACHE_VERSION}`
const MAP_CACHE     = `ndnp-map-${CACHE_VERSION}`
const API_CACHE     = `ndnp-api-${CACHE_VERSION}`

// App shell: cached on install so the app opens offline
const APP_SHELL = [
  '/',
  '/report',
  '/register',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// ── Install: cache app shell ──────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL).catch(() => {}))
  )
})

// ── Activate: clean old caches, claim clients ────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== MAP_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Background Sync: triggered when connectivity returns ──────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-reports') {
    // Tell all open app windows to run the sync
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        // Post a message to each open tab asking it to sync
        clients.forEach(client => {
          client.postMessage({ type: 'SW_SYNC_TRIGGER' })
        })
        // If no windows are open, we can't sync from SW context directly
        // (we'd need the service worker to have supabase credentials)
        // The app will sync on next open when it's online.
      })
    )
  }
})

// ── Fetch: smart caching strategy ───────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:') return
  if (url.protocol === 'data:') return

  // Esri / OSM map tiles: Cache First (long TTL)
  if (
    url.hostname.includes('arcgisonline.com') ||
    url.hostname.includes('tile.openstreetmap.org')
  ) {
    event.respondWith(cacheFirst(MAP_CACHE, request))
    return
  }

  // Supabase REST/Storage: Network First
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(API_CACHE, request))
    return
  }

  // Next.js static assets: Cache First
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(STATIC_CACHE, request))
    return
  }

  // HTML pages: Network First (keeps content fresh)
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(networkFirst(STATIC_CACHE, request))
    return
  }

  // Everything else: Stale While Revalidate
  event.respondWith(staleWhileRevalidate(STATIC_CACHE, request))
})

// ── Caching helpers ───────────────────────────────────────────────────────

async function cacheFirst(cacheName, request) {
  const cache  = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return offlineResponse(request)
  }
}

async function networkFirst(cacheName, request) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    return cached ?? offlineResponse(request)
  }
}

async function staleWhileRevalidate(cacheName, request) {
  const cache  = await caches.open(cacheName)
  const cached = await cache.match(request)
  const fresh  = fetch(request)
    .then(r => { if (r.ok) cache.put(request, r.clone()); return r })
    .catch(() => null)
  return cached ?? (await fresh) ?? offlineResponse(request)
}

function offlineResponse(request) {
  if (request.headers.get('Accept')?.includes('text/html')) {
    return new Response(
      '<html><body style="background:#020b14;color:#e2f0f9;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center"><div><h2 style="color:#00bcd4">You are offline</h2><p>Connect to the internet to use the NDNP MPA-MES portal.</p><p style="color:#5a7d94;font-size:12px;margin-top:12px">Any incident reports you capture will sync automatically when connectivity returns.</p></div></body></html>',
      { status:200, headers:{'Content-Type':'text/html'} }
    )
  }
  return new Response('Offline', { status:503, headers:{'Content-Type':'text/plain'} })
}

