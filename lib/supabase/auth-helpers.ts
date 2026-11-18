import { createClient } from '@/lib/supabase/client'
import { audit } from '@/lib/audit/log-action'

/**
 * Clears browser-side Supabase auth cookies, storage keys, and dynamic Service Worker
 * caches so switching accounts never serves a prior user's cached session or RSC payload.
 */
export async function clearClientAuthArtifacts(): Promise<void> {
  if (typeof window === 'undefined') return

  // 1. Expire any client-visible sb-* cookies (including chunked tokens like .0, .1)
  try {
    const cookies = document.cookie ? document.cookie.split(';') : []
    for (const rawCookie of cookies) {
      const eqIdx = rawCookie.indexOf('=')
      const name = (eqIdx >= 0 ? rawCookie.slice(0, eqIdx) : rawCookie).trim()
      if (!name || !name.startsWith('sb-')) continue

      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/`
      if (window.location.protocol === 'https:') {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/; SameSite=None; Secure`
      }
    }
  } catch {}

  // 2. Clear any sb-* keys in localStorage / sessionStorage
  try {
    const lsKeys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-')) lsKeys.push(k)
    }
    lsKeys.forEach((k) => localStorage.removeItem(k))
  } catch {}

  try {
    const ssKeys: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith('sb-')) ssKeys.push(k)
    }
    ssKeys.forEach((k) => sessionStorage.removeItem(k))
  } catch {}

  // 3. Purge dynamic/API/page Service Worker caches (keep offline map tiles & static bundles)
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_AUTH_CACHES' })
    }
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames.map(async (name) => {
          if (name.startsWith('ndnp-api-')) {
            await caches.delete(name)
            return
          }
          if (name.startsWith('ndnp-static-')) {
            const cache = await caches.open(name)
            const keys = await cache.keys()
            await Promise.all(
              keys.map((req) => {
                try {
                  const pathname = new URL(req.url).pathname
                  const isStaticAsset =
                    pathname.startsWith('/_next/static/') ||
                    pathname.startsWith('/icons/') ||
                    pathname === '/manifest.json' ||
                    /\.(png|jpg|jpeg|svg|webp|ico|css|js|woff2?)$/i.test(pathname)
                  if (!isStaticAsset) {
                    return cache.delete(req)
                  }
                } catch {}
                return Promise.resolve(false)
              })
            )
          }
        })
      )
    }
  } catch {}
}

/**
 * Fully signs out on both client and server, clears all auth cookies & SW caches,
 * and triggers a hard browser navigation so Next.js Router Cache cannot retain the old session.
 */
export async function signOutAndRedirect(redirectTo = '/'): Promise<void> {
  try {
    await audit.logout()
  } catch {}
  try {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    }
  } catch {
    try {
      await createClient().auth.signOut({ scope: 'local' })
    } catch {}
  }

  try {
    await fetch('/api/auth/signout', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
    })
  } catch {}

  await clearClientAuthArtifacts()

  if (typeof window !== 'undefined') {
    window.location.replace(redirectTo)
  }
}
