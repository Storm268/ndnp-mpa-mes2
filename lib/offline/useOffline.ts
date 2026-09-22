'use client'
/**
 * useOffline — React hook that tracks connectivity state and drives the sync engine.
 *
 * Returns:
 *   isOnline      — current network state
 *   pendingCount  — number of reports waiting to be synced
 *   isSyncing     — true while upload is in progress
 *   syncProgress  — { done, total } during a sync pass
 *   lastSynced    — timestamp of last successful sync
 *   triggerSync   — manually start a sync
 *   enqueue       — save a form payload for later sync
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { getPendingCount, enqueueReport, type FormType } from './db'
import { syncAllPending, prefetchReferenceData }       from './sync'

export interface OfflineState {
  isOnline:     boolean
  pendingCount: number
  isSyncing:    boolean
  syncProgress: { done: number; total: number } | null
  lastSynced:   Date | null
  syncError:    string | null
  triggerSync:  () => void
  enqueue:      (opts: EnqueueOpts) => Promise<string>
  refreshCount: () => void
}

export interface EnqueueOpts {
  form_type:    FormType
  table:        string
  payload:      Record<string, unknown>
  photo_blobs?: string[]
}

export function useOffline(): OfflineState {
  const [isOnline,     setIsOnline]     = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing,    setIsSyncing]    = useState(false)
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null)
  const [lastSynced,   setLastSynced]   = useState<Date | null>(null)
  const [syncError,    setSyncError]    = useState<string | null>(null)
  const syncLock = useRef(false)

  // ── Track online / offline ──────────────────────────────────────────────────
  useEffect(() => {
    // Set initial state (avoids SSR mismatch)
    setIsOnline(navigator.onLine)

    const handleOnline  = () => { setIsOnline(true);  triggerSyncInternal() }
    const handleOffline = () => { setIsOnline(false); setSyncError(null) }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    // Also sync when app comes back into focus
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        triggerSyncInternal()
      }
    })

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Refresh pending count ────────────────────────────────────────────────
  const refreshCount = useCallback(async () => {
    const n = await getPendingCount()
    setPendingCount(n)
  }, [])

  useEffect(() => {
    refreshCount()
    // Prefetch stations/heritage so forms work offline
    if (navigator.onLine) prefetchReferenceData()
  }, [refreshCount])

  // ── Sync engine ───────────────────────────────────────────────────────────
  async function triggerSyncInternal() {
    if (syncLock.current || !navigator.onLine) return
    const count = await getPendingCount()
    if (count === 0) return

    syncLock.current = true
    setIsSyncing(true)
    setSyncError(null)
    setSyncProgress({ done: 0, total: count })

    try {
      const result = await syncAllPending((done, total) => {
        setSyncProgress({ done, total })
      })
      setLastSynced(new Date())
      if (result.failed > 0) {
        setSyncError(`${result.failed} report${result.failed !== 1 ? 's' : ''} failed to sync. Will retry.`)
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      syncLock.current = false
      setIsSyncing(false)
      setSyncProgress(null)
      await refreshCount()
    }
  }

  const triggerSync = useCallback(() => { triggerSyncInternal() }, []) // eslint-disable-line

  // ── Enqueue a report for offline storage ────────────────────────────────
  const enqueue = useCallback(async (opts: EnqueueOpts): Promise<string> => {
    const id = await enqueueReport(opts)
    await refreshCount()
    return id
  }, [refreshCount])

  return { isOnline, pendingCount, isSyncing, syncProgress, lastSynced, syncError, triggerSync, enqueue, refreshCount }
}

