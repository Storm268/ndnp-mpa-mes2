/**
 * NDNP MPA-MES — Offline Map Tile Caching Engine
 * 
 * Pre-caches and manages satellite map tiles and nautical basemaps
 * for Nelson's Dockyard National Park Marine Protected Area,
 * English Harbour, Falmouth Harbour, and Fort Berkeley.
 */

// Bounding Box for Nelson's Dockyard National Park and coastal waters
export const PARK_BOUNDING_BOX = {
  minLat: 16.995,
  maxLat: 17.025,
  minLon: -61.785,
  maxLon: -61.745,
}

export const MAP_CACHE_NAME = 'ndnp-map-v3'

// Convert Latitude / Longitude to Slippy Map Tile coordinate (x, y)
export function latLonToTile(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const latRad = (lat * Math.PI) / 180
  const n = Math.pow(2, zoom)
  const x = Math.floor(((lon + 180) / 360) * n)
  const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n)
  return { x, y }
}

// Generate the complete set of Esri World Imagery satellite tile URLs covering the park
export function getParkTileUrls(minZoom = 13, maxZoom = 16): string[] {
  const urls: string[] = []

  for (let z = minZoom; z <= maxZoom; z++) {
    const p1 = latLonToTile(PARK_BOUNDING_BOX.maxLat, PARK_BOUNDING_BOX.minLon, z)
    const p2 = latLonToTile(PARK_BOUNDING_BOX.minLat, PARK_BOUNDING_BOX.maxLon, z)

    const minX = Math.min(p1.x, p2.x)
    const maxX = Math.max(p1.x, p2.x)
    const minY = Math.min(p1.y, p2.y)
    const maxY = Math.max(p1.y, p2.y)

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        urls.push(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`)
      }
    }
  }

  return urls
}

// Crisp nautical vector SVG tile data URL used as fallback when a tile is uncached offline
export const OFFLINE_FALLBACK_TILE_DATA_URL =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
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
    </svg>
  `)

export interface CacheProgress {
  loaded: number
  total: number
  percent: number
  isComplete: boolean
}

/**
 * Downloads and caches all satellite tiles covering Nelson's Dockyard National Park
 * directly into the Service Worker CacheStorage bucket (ndnp-map-v3).
 */
export async function cacheParkMapOffline(
  onProgress?: (progress: CacheProgress) => void
): Promise<{ success: boolean; totalCached: number }> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { success: false, totalCached: 0 }
  }

  try {
    const cache = await caches.open(MAP_CACHE_NAME)
    const tileUrls = getParkTileUrls(13, 16)
    const total = tileUrls.length
    let loaded = 0

    // Process in batches of 6 concurrent requests to prevent network throttling
    const BATCH_SIZE = 6
    for (let i = 0; i < tileUrls.length; i += BATCH_SIZE) {
      const batch = tileUrls.slice(i, i + BATCH_SIZE)
      await Promise.allSettled(
        batch.map(async (url) => {
          try {
            // Check if already in cache first
            const existing = await cache.match(url)
            if (existing) {
              loaded++
              return
            }

            const res = await fetch(url, { mode: 'cors', cache: 'no-cache' })
            if (res.ok) {
              await cache.put(url, res)
            }
          } catch (err) {
            console.warn('[OfflineMap] Tile fetch skip:', url, err)
          } finally {
            loaded++
            onProgress?.({
              loaded,
              total,
              percent: Math.min(100, Math.round((loaded / total) * 100)),
              isComplete: loaded >= total,
            })
          }
        })
      )
    }

    // Also pre-cache map marker pins and Leaflet assets
    const auxAssets = [
      '/dashboard/citizen',
      '/marker-icon.png',
      '/marker-icon-2x.png',
      '/marker-shadow.png',
      '/layers.png',
      '/layers-2x.png',
    ]
    await Promise.allSettled(
      auxAssets.map(async (u) => {
        try {
          const res = await fetch(u)
          if (res.ok) await cache.put(u, res)
        } catch {
          // ignore
        }
      })
    )

    onProgress?.({
      loaded: total,
      total,
      percent: 100,
      isComplete: true,
    })

    return { success: true, totalCached: loaded }
  } catch (err) {
    console.error('[OfflineMap] Error caching park map:', err)
    return { success: false, totalCached: 0 }
  }
}

/**
 * Checks if the park map tiles are already present in cache.
 */
export async function isMapCachedOffline(): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false
  try {
    const hasCache = await caches.has(MAP_CACHE_NAME)
    if (!hasCache) return false
    const cache = await caches.open(MAP_CACHE_NAME)
    // Check one key center tile at zoom 15
    const centerTile = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/14812/10761'
    const match = await cache.match(centerTile)
    return !!match
  } catch {
    return false
  }
}
