'use client'
/**
 * PWARegister — registers the service worker and listens for
 * Background Sync trigger messages from the SW.
 */
import { useEffect } from 'react'

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    // Register in both dev and prod for offline to work
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[SW] Registered scope:', reg.scope)

        // Check for updates periodically
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing
          newSW?.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW] New version ready')
            }
          })
        })
      })
      .catch(err => console.warn('[SW] Registration failed:', err))

    // Listen for sync trigger from SW Background Sync
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'SW_SYNC_TRIGGER') {
        // Lazy import the sync engine to avoid loading it on every page
        import('@/lib/offline/sync')
          .then(({ syncAllPending }) => syncAllPending())
          .catch(() => {})
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => { navigator.serviceWorker.removeEventListener('message', handler) }
  }, [])

  return null
}

