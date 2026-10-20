// NDNP MPA-MES Service Worker v6
// • Comprehensive Offline Caching (App shell, Citizen Portal, Map tiles, Species & Heritage guides)
// • Background Sync for queued incident & wildlife reports

const CACHE_VERSION = 'v6'
const STATIC_CACHE  = `ndnp-static-${CACHE_VERSION}`
const MAP_CACHE     = `ndnp-map-${CACHE_VERSION}`
const API_CACHE     = `ndnp-api-${CACHE_VERSION}`

// Critical App Shell: pre-cached immediately upon SW install
const APP_SHELL = [
  '/',
  '/dashboard/citizen',
  '/citizen',
  '/report',
  '/register',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
  '/marker-icon.png',
  '/marker-icon-2x.png',
  '/marker-shadow.png',
  '/layers.png',
  '/layers-2x.png',
]

// Core satellite map tiles covering Nelson's Dockyard, English Harbour, and Falmouth Harbour (Zooms 13-15)
const CORE_PARK_MAP_TILES = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3702/2690',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3703/2690',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/7405/5380',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/7406/5380',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/7405/5381',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/7406/5381',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/14811/10760',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/14812/10760',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/14813/10760',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/14811/10761',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/14812/10761',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/14813/10761',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/14811/10762',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/14812/10762',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/14813/10762',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/14811/10763',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/14812/10763',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/14813/10763',
]

// ── Install: Pre-cache App Shell and Core Satellite Map Tiles ─────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    Promise.all([
      // 1. App Shell
      caches.open(STATIC_CACHE).then((cache) => {
        return Promise.allSettled(
          APP_SHELL.map((url) =>
            fetch(url, { cache: 'no-cache' })
              .then((res) => {
                if (res && res.ok) return cache.put(url, res)
              })
              .catch((err) => console.warn('[SW] Pre-cache skip:', url, err))
          )
        )
      }),
      // 2. Core Marine Map Tiles
      caches.open(MAP_CACHE).then((cache) => {
        return Promise.allSettled(
          CORE_PARK_MAP_TILES.map((url) =>
            fetch(url, { mode: 'cors', cache: 'no-cache' })
              .then((res) => {
                if (res && res.ok) return cache.put(url, res)
              })
              .catch((err) => console.warn('[SW] Map tile pre-cache skip:', url, err))
          )
        )
      }),
    ])
  )
})

// ── Activate: Clean old cache buckets & claim clients ────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== MAP_CACHE && k !== API_CACHE && !k.startsWith('ndnp-map'))
          .map((k) => caches.delete(k))
      )
    }).then(() => self.clients.claim())
  )
})

// ── Background Sync: Trigger offline queue sync ─────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-reports') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_SYNC_TRIGGER' })
        })
      })
    )
  }
})

// ── Fetch: Offline-First & Network-First routing ────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:' || url.protocol === 'data:') return

  // 1. GIS & Map tiles (Esri, OpenStreetMap, Carto, Stamen): Cache First with SVG fallback
  if (
    url.hostname.includes('arcgisonline.com') ||
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('basemaps.cartocdn.com')
  ) {
    event.respondWith(cacheFirstMapTile(MAP_CACHE, request))
    return
  }

  // 2. Next.js static assets & chunks (scripts, styles, fonts):
  // Cache First with background network revalidation for fast & reliable offline home screen launches
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) {
          // Revalidate in background to keep assets fresh across deployments
          fetch(request).then((networkRes) => {
            if (networkRes && networkRes.ok) cache.put(request, networkRes)
          }).catch(() => {})
          return cached
        }

        try {
          const fresh = await fetch(request)
          if (fresh && fresh.ok) {
            cache.put(request, fresh.clone())
          }
          return fresh
        } catch {
          // If offline and chunk not yet cached: return valid JS/CSS rather than an error page
          if (url.pathname.endsWith('.js')) {
            return new Response('/* offline chunk placeholder */', {
              status: 200,
              headers: { 'Content-Type': 'application/javascript' },
            })
          }
          if (url.pathname.endsWith('.css')) {
            return new Response('/* offline css */', {
              status: 200,
              headers: { 'Content-Type': 'text/css' },
            })
          }
          return new Response('Resource offline', { status: 503 })
        }
      })
    )
    return
  }

  // 3. Other Next.js runtime paths (e.g. data or HMR)
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE)
        return (await cache.match(request)) || new Response('', { status: 204 })
      })
    )
    return
  }

  // 4. Static icons & images: Cache First
  if (url.pathname.startsWith('/icons/') || url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.svg')) {
    event.respondWith(cacheFirst(STATIC_CACHE, request))
    return
  }

  // 5. Supabase REST API: Network First
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(API_CACHE, request))
    return
  }

  // 4. HTML Page Navigations: Network First with cached fallback
  if (request.mode === 'navigate' || request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(networkFirstPage(STATIC_CACHE, request))
    return
  }

  // 5. All other GET requests (images, styles, data): Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(STATIC_CACHE, request))
})

// ── Caching Helpers ──────────────────────────────────────────────────────────

async function cacheFirstMapTile(cacheName, request) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response && response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    // If offline and tile was not cached: return fallback marine bathymetric SVG tile
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#0a253e" stroke-width="0.75"/>
          </pattern>
        </defs>
        <rect width="256" height="256" fill="#06192a" />
        <rect width="256" height="256" fill="url(#grid)" />
        <path d="M0,64 Q64,52 128,70 T256,58" fill="none" stroke="#0e3a5f" stroke-width="1.5" stroke-dasharray="4,4" />
        <path d="M0,130 Q64,118 128,136 T256,122" fill="none" stroke="#0e3a5f" stroke-width="1.5" stroke-dasharray="4,4" />
        <path d="M0,195 Q64,182 128,200 T256,186" fill="none" stroke="#0e3a5f" stroke-width="1.5" stroke-dasharray="4,4" />
        <circle cx="128" cy="128" r="3" fill="#00bcd4" opacity="0.4" />
        <text x="128" y="242" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="8.5" font-weight="700" fill="#38bdf8" opacity="0.3" text-anchor="middle" letter-spacing="1">NDNP MARINE SANCTUARY</text>
      </svg>`,
      { status: 200, headers: { 'Content-Type': 'image/svg+xml' } }
    )
  }
}

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response && response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return cached ?? new Response('Resource offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
}

async function networkFirstPage(cacheName, request) {
  const cache = await caches.open(cacheName)
  const url = new URL(request.url)

  try {
    const response = await fetch(request)
    if (response && response.ok) {
      cache.put(request, response.clone())
      cache.put(url.pathname, response.clone())
    }
    return response
  } catch (err) {
    // 1. Try exact match
    const cached = (await cache.match(request)) || (await cache.match(url.pathname))
    if (cached) return cached

    // 2. If navigating to citizen page specifically, try '/dashboard/citizen' or '/citizen'
    if (url.pathname.includes('citizen')) {
      const citizenCached = (await cache.match('/dashboard/citizen')) || (await cache.match('/citizen'))
      if (citizenCached) return citizenCached
    }

    // 3. Try root shell or dashboard citizen
    const rootCached = (await cache.match('/')) || (await cache.match('/dashboard/citizen'))
    if (rootCached) return rootCached

    // 4. Try any cached HTML page in cache
    const keys = await cache.keys()
    for (const k of keys) {
      if (k.url.endsWith('/') || k.url.includes('/dashboard/citizen') || k.url.includes('/citizen')) {
        const fallback = await cache.match(k)
        if (fallback) return fallback
      }
    }

    // 5. Fallback offline recovery page
    return offlineHtmlResponse()
  }
}

async function networkFirst(cacheName, request) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(request)
    return cached ?? new Response(JSON.stringify({ error: 'Network unavailable (offline mode)' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const freshPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  return cached || (await freshPromise) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
}

function offlineHtmlResponse() {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NDNP MPA — Offline Mode</title>
  <style>
    body {
      background: #020b14;
      color: #e2f0f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
      text-align: center;
    }
    .card {
      max-width: 480px;
      background: #061928;
      border: 1px solid rgba(0, 188, 212, 0.25);
      border-radius: 16px;
      padding: 32px 24px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #fbbf24;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 16px;
    }
    h1 { font-size: 22px; margin: 0 0 10px 0; color: #ffffff; }
    p { font-size: 14px; color: #8bb2cc; line-height: 1.6; margin: 0 0 24px 0; }
    .btn-group { display: flex; flex-direction: column; gap: 10px; }
    .btn {
      display: block;
      padding: 12px 20px;
      border-radius: 10px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      transition: all 0.2s;
    }
    .btn-primary { background: linear-gradient(135deg, #00bcd4, #0077a8); color: #ffffff; }
    .btn-secondary { background: #0c2b42; color: #8bb2cc; border: 1px solid rgba(255,255,255,0.1); }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">📡 Offline Mode Active</div>
    <h1>Nelson's Dockyard National Park</h1>
    <p>You are currently operating off-grid without an active internet connection. You can still access cached park maps, species guides, and record offline incident reports.</p>
    <div class="btn-group">
      <a class="btn btn-primary" href="/dashboard/citizen">Open Citizen Dashboard & Map</a>
      <a class="btn btn-secondary" href="/report">Submit Offline Incident Report</a>
    </div>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

// ── Message: Debugging & status reporting ─────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_SW_STATUS') {
    Promise.all([
      caches.open(STATIC_CACHE).then((c) => c.keys()),
      caches.open(MAP_CACHE).then((c) => c.keys()),
      caches.open(API_CACHE).then((c) => c.keys()),
    ]).then(([staticKeys, mapKeys, apiKeys]) => {
      event.source?.postMessage({
        type: 'SW_STATUS_RESPONSE',
        version: CACHE_VERSION,
        staticCount: staticKeys.length,
        mapCount: mapKeys.length,
        apiCount: apiKeys.length,
        staticUrls: staticKeys.map((k) => new URL(k.url).pathname),
      })
    })
  }
})

