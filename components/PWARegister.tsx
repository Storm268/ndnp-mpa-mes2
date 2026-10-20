'use client'

/**
 * PWARegister — registers the service worker, handles background sync triggers,
 * and provides window.__DEBUG_PWA() diagnostic utilities to inspect offline cache.
 */
import { useEffect } from 'react'

declare global {
  interface Window {
    __DEBUG_PWA?: () => Promise<Record<string, unknown>>
    __FORCE_UPDATE_SW?: () => Promise<void>
  }
}

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) {
      console.warn('[PWA] Service Workers not supported in this browser environment.')
      return
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone === true)

    console.log(
      `[PWA] Launch mode: ${isStandalone ? '📱 Standalone PWA (Home Screen)' : '🌐 Browser Tab'}`
    )

    // Register service worker with root scope
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[PWA] Service Worker registered with scope:', reg.scope)

        // Force check for fresh version to avoid stale caches
        reg.update().catch(() => {})

        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing
          newSW?.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New service worker version installed and ready.')
            }
          })
        })
      })
      .catch((err) => {
        console.error('[PWA] Service Worker registration failed:', err)
      })

    // Listen for sync triggers and status reports from SW
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'SW_SYNC_TRIGGER') {
        import('@/lib/offline/sync')
          .then(({ syncAllPending }) => syncAllPending())
          .catch(() => {})
      }
      if (event.data?.type === 'SW_STATUS_RESPONSE') {
        console.info('[PWA-Diagnostics] Service Worker Status:', event.data)
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)

    // Expose interactive debugging helper on window
    window.__DEBUG_PWA = async () => {
      const isOnline = navigator.onLine
      const reg = await navigator.serviceWorker.getRegistration()
      const cacheNames = await caches.keys()
      const cacheDetails: Record<string, number> = {}

      for (const name of cacheNames) {
        const cache = await caches.open(name)
        const keys = await cache.keys()
        cacheDetails[name] = keys.length
      }

      // Test matching critical home-screen landing URLs
      const testRoutes = ['/', '/dashboard/citizen', '/report', '/manifest.json']
      const cacheMatchResults: Record<string, boolean> = {}

      for (const r of testRoutes) {
        const match = await caches.match(r)
        cacheMatchResults[r] = Boolean(match)
      }

      const report = {
        online: isOnline,
        standaloneDisplayMode: isStandalone,
        serviceWorkerRegistered: Boolean(reg),
        serviceWorkerActive: Boolean(reg?.active),
        serviceWorkerState: reg?.active?.state || 'none',
        serviceWorkerScope: reg?.scope || 'none',
        cachesPresent: cacheNames,
        cachedItemCounts: cacheDetails,
        landingRoutesCached: cacheMatchResults,
      }

      console.group('🔧 [PWA Debugger Report]')
      console.table({
        'Online Status': isOnline ? 'Online' : 'Offline',
        'Launched from Home Screen': isStandalone ? 'Yes (Standalone)' : 'No (Browser Tab)',
        'SW Registered': Boolean(reg),
        'SW Active': Boolean(reg?.active),
        'SW State': reg?.active?.state || 'none',
      })
      console.log('Cache Storage Buckets:', cacheDetails)
      console.log('Landing Route Match Results:', cacheMatchResults)
      console.groupEnd()

      return report
    }

    window.__FORCE_UPDATE_SW = async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        console.log('[PWA] Forcing Service Worker update...')
        await reg.update()
        console.log('[PWA] Service Worker update check complete.')
      }
    }

    console.info(
      '💡 [PWA Debug] Run `window.__DEBUG_PWA()` in the console to inspect Service Worker & offline cache status.'
    )

    return () => {
      navigator.serviceWorker.removeEventListener('message', handler)
    }
  }, [])

  return null
}
