'use client'
/**
 * OfflineBar — Persistent status strip shown at the top of dashboard pages.
 *
 * States:
 *   • Hidden when online + no pending reports
 *   • Yellow “Offline” when no connectivity
 *   • Teal “Syncing X reports…” while uploading
 *   • Brief green “Synced” confirmation on success
 *   • Red error if sync fails
 */
import { useOffline } from '@/lib/offline/useOffline'
import { useState, useEffect } from 'react'

export default function OfflineBar() {
  const {
    isOnline, pendingCount, isSyncing,
    syncProgress, lastSynced, syncError, triggerSync,
  } = useOffline()

  const [showSynced, setShowSynced] = useState(false)

  useEffect(() => {
    if (lastSynced) {
      setShowSynced(true)
      const t = setTimeout(() => setShowSynced(false), 3000)
      return () => clearTimeout(t)
    }
  }, [lastSynced])

  // Hidden if online, nothing pending, not syncing, no error
  const isHidden = isOnline && pendingCount === 0 && !isSyncing && !syncError && !showSynced
  if (isHidden) return null

  // ── Pick bar style ─────────────────────────────────────────────────────
  let bg      = 'rgba(245,158,11,0.12)'
  let border  = 'rgba(245,158,11,0.35)'
  let color   = '#fbbf24'
  let icon: React.ReactNode = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0"/>
      <line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>
  )
  let message = `Offline — ${pendingCount} report${pendingCount !== 1 ? 's' : ''} queued`
  let subtext = 'Data will sync automatically when connectivity returns'

  if (isSyncing) {
    bg = 'rgba(0,188,212,0.1)'; border = 'rgba(0,188,212,0.35)'; color = '#00bcd4'
    icon = (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:'spin 1s linear infinite' }}>
        <path d="M21 12a9 9 0 1 1-18 0"/>
      </svg>
    )
    if (syncProgress) {
      message = `Syncing ${syncProgress.done}/${syncProgress.total} report${syncProgress.total !== 1 ? 's' : ''}…`
    } else {
      message = 'Syncing queued reports…'
    }
    subtext = 'Uploading to Supabase and park map'
  } else if (showSynced && !syncError) {
    bg = 'rgba(16,185,129,0.1)'; border = 'rgba(16,185,129,0.35)'; color = '#10b981'
    icon = (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
      </svg>
    )
    message = 'All reports synced successfully'
    subtext = `Synced at ${lastSynced?.toLocaleTimeString()}`
  } else if (syncError) {
    bg = 'rgba(239,68,68,0.08)'; border = 'rgba(239,68,68,0.3)'; color = '#f87171'
    icon = (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/>
      </svg>
    )
    message = syncError
    subtext = pendingCount > 0 ? `${pendingCount} report${pendingCount !== 1 ? 's' : ''} still pending` : ''
  } else if (isOnline && pendingCount > 0) {
    // Online but pending reports exist (unusual — sync trigger pending)
    bg = 'rgba(0,188,212,0.08)'; border = 'rgba(0,188,212,0.3)'; color = '#00bcd4'
    icon = (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-8-4-4m0 0L8 8m4-4v12"/>
      </svg>
    )
    message = `${pendingCount} report${pendingCount !== 1 ? 's' : ''} pending sync`
    subtext = 'Tap to sync now'
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '9px 16px',
      background: bg,
      borderBottom: `1px solid ${border}`,
      fontSize: '12px',
      lineHeight: 1.4,
      transition: 'background 300ms',
    }}>
      <span style={{ color, flexShrink: 0 }}>{icon}</span>

      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 700, color }}>{message}</span>
        {subtext && (
          <span style={{ color: color, opacity: 0.7, marginLeft: '8px' }}>{subtext}</span>
        )}
      </div>

      {/* Progress bar */}
      {isSyncing && syncProgress && syncProgress.total > 0 && (
        <div style={{ width: '80px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{
            height: '100%',
            background: '#00bcd4',
            borderRadius: '2px',
            width: `${Math.round((syncProgress.done / syncProgress.total) * 100)}%`,
            transition: 'width 300ms',
          }} />
        </div>
      )}

      {/* Manual sync button (when online + pending) */}
      {isOnline && pendingCount > 0 && !isSyncing && (
        <button
          onClick={triggerSync}
          style={{ padding: '4px 10px', border: `1px solid ${border}`, borderRadius: '6px', background: 'transparent', color, fontSize: '11px', fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}
        >
          Sync Now
        </button>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

