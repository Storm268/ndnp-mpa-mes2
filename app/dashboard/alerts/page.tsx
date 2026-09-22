'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { audit } from '@/lib/audit/log-action'

// ── Types ──────────────────────────────────────────────────────
type AlertType = 'patrol_incident'|'geofence_entry'|'low_sync'|'bleaching_alert'|'severity_high'|'wq_exceedance'|'heritage_critical'
type FilterTab = 'all'|'new'|'acknowledged'|'resolved'

interface Alert {
  id: string
  alert_type: AlertType
  title: string
  message: string
  is_read: boolean
  recipients: Record<string, string> | null
  channel: string
  created_at: string
  triggered_by: string | null
  related_record_id: string | null
  related_table: string | null
  severity?: number | null
  gps_lat?: number | null
  gps_lng?: number | null
}

// ── Alert status helpers ────────────────────────────────────────
function getStatus(a: Alert): 'new' | 'acknowledged' | 'resolved' {
  if (!a.is_read) return 'new'
  if (a.recipients?.resolved_at) return 'resolved'
  return 'acknowledged'
}

// ── Alert type config ───────────────────────────────────────────
const TYPE_CONFIG: Record<AlertType, { label: string; color: string; bg: string; border: string; svgPath: string }> = {
  severity_high:    { label: 'High Severity',     color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   svgPath: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01' },
  heritage_critical:{ label: 'Heritage Critical', color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.25)',  svgPath: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  patrol_incident:  { label: 'Patrol Incident',   color: '#4fb3e8', bg: 'rgba(79,179,232,0.08)',  border: 'rgba(79,179,232,0.25)',  svgPath: 'M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z' },
  bleaching_alert:  { label: 'Bleaching Alert',   color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  svgPath: 'M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12' },
  wq_exceedance:    { label: 'WQ Exceedance',     color: '#0891b2', bg: 'rgba(8,145,178,0.08)',   border: 'rgba(8,145,178,0.25)',   svgPath: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z' },
  geofence_entry:   { label: 'Geofence Entry',    color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.25)', svgPath: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z' },
  low_sync:         { label: 'Low Sync',          color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.25)', svgPath: 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zm7-4v16m8-20v16' },
}

export default function AlertsPage() {
  const [alerts,    setAlerts]    = useState<Alert[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<FilterTab>('new')
  const [newCount,  setNewCount]  = useState(0)
  const [acting,    setActing]    = useState<string | null>(null)
  const [flash,     setFlash]     = useState<{ id: string; type: 'ack'|'res' } | null>(null)
  const [liveAlert, setLiveAlert] = useState<string | null>(null)

  // ── Fetch ─────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    const sb = createClient()
    const { data, error } = await sb
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (!error && data) {
      setAlerts(data as Alert[])
      setNewCount(data.filter(a => !a.is_read).length)
    }
    setLoading(false)
  }, [])

  // ── Realtime ──────────────────────────────────────────────────
  useEffect(() => {
    fetchAlerts()
    const sb = createClient()
    const ch = sb.channel('alerts-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, payload => {
        if (payload.eventType === 'INSERT') {
          const a = payload.new as Alert
          setAlerts(p => [a, ...p])
          setNewCount(c => c + 1)
          setLiveAlert(a.title)
          setTimeout(() => setLiveAlert(null), 6000)
        } else if (payload.eventType === 'UPDATE') {
          setAlerts(p => p.map(a => a.id === (payload.new as Alert).id ? payload.new as Alert : a))
          setNewCount(0) // recalculate after update
          fetchAlerts()
        }
      })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [fetchAlerts])

  // ── Actions ───────────────────────────────────────────────────
  async function acknowledge(id: string) {
    setActing(id)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    await sb.from('alerts').update({
      is_read: true,
      recipients: { acknowledged_at: new Date().toISOString(), acknowledged_by: user?.id ?? 'unknown' }
    }).eq('id', id)
    await audit.alertAcknowledged(id, alerts.find(a => a.id === id)?.title ?? 'Alert')
    setFlash({ id, type: 'ack' })
    setTimeout(() => setFlash(null), 2000)
    setActing(null)
    fetchAlerts()
  }

  async function resolve(id: string) {
    setActing(id)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const existing = alerts.find(a => a.id === id)?.recipients ?? {}
    await sb.from('alerts').update({
      is_read: true,
      recipients: { ...existing, resolved_at: new Date().toISOString(), resolved_by: user?.id ?? 'unknown' }
    }).eq('id', id)
    await audit.alertResolved(id, alerts.find(a => a.id === id)?.title ?? 'Alert')
    setFlash({ id, type: 'res' })
    setTimeout(() => setFlash(null), 2000)
    setActing(null)
    fetchAlerts()
  }

  async function reopen(id: string) {
    setActing(id)
    const sb = createClient()
    await sb.from('alerts').update({ is_read: false, recipients: {} }).eq('id', id)
    setActing(null)
    fetchAlerts()
  }

  // ── Filter ────────────────────────────────────────────────────
  const displayed = alerts.filter(a => {
    const s = getStatus(a)
    if (filter === 'all')          return true
    if (filter === 'new')          return s === 'new'
    if (filter === 'acknowledged') return s === 'acknowledged'
    if (filter === 'resolved')     return s === 'resolved'
    return true
  })

  const counts = {
    all:          alerts.length,
    new:          alerts.filter(a => getStatus(a) === 'new').length,
    acknowledged: alerts.filter(a => getStatus(a) === 'acknowledged').length,
    resolved:     alerts.filter(a => getStatus(a) === 'resolved').length,
  }

  const TAB_COLOR: Record<FilterTab, string> = {
    all: 'var(--text-muted)', new: '#ef4444', acknowledged: '#f59e0b', resolved: '#22c55e'
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ padding:'24px 32px', maxWidth:'900px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'22px' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
            <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--text)', letterSpacing:'-0.02em' }}>Alerts & Notifications</h1>
            {counts.new > 0 && (
              <span style={{ background:'#ef4444', color:'#fff', fontSize:'0.65rem', fontWeight:800, padding:'2px 8px', borderRadius:'10px', letterSpacing:'0.04em' }}>{counts.new} NEW</span>
            )}
          </div>
          <p style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>FR-ALERT-01 · High-severity incidents · Critical heritage conditions · Patrol reports</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'0.65rem', fontWeight:700, color:'var(--teal)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
          <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--teal)', display:'inline-block', animation:'livePulse 2s ease-in-out infinite' }} />
          Live
        </div>
      </div>

      {/* Live alert banner */}
      {liveAlert && (
        <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'8px', padding:'10px 16px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px', animation:'fadeIn 0.3s ease' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/></svg>
          <span style={{ fontSize:'0.8rem', fontWeight:600, color:'#fca5a5' }}>New alert: {liveAlert}</span>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:'4px', marginBottom:'18px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'4px' }}>
        {(['new','acknowledged','resolved','all'] as FilterTab[]).map(tab => (
          <button key={tab} onClick={() => setFilter(tab)}
            style={{ flex:1, padding:'7px 6px', borderRadius:'5px', border:'none', cursor:'pointer', fontSize:'0.75rem', fontWeight: filter === tab ? 700 : 400,
              background: filter === tab ? 'var(--surface2)' : 'transparent',
              color: filter === tab ? TAB_COLOR[tab] : 'var(--text-muted)', transition:'all 150ms',
              display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span style={{ background: filter === tab ? `${TAB_COLOR[tab]}20` : 'transparent', border: filter === tab ? `1px solid ${TAB_COLOR[tab]}40` : 'none', borderRadius:'4px', padding:'0 5px', fontSize:'0.65rem', fontWeight:700, color: filter === tab ? TAB_COLOR[tab] : 'var(--text-muted)' }}>
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Alert cards */}
      {loading && (
        <div style={{ textAlign:'center', padding:'40px', color:'var(--text-muted)', fontSize:'0.85rem' }}>
          Loading alerts…
        </div>
      )}

      {!loading && displayed.length === 0 && (
        <div style={{ textAlign:'center', padding:'48px 24px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', color:'var(--text-muted)' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display:'block', margin:'0 auto 12px', opacity:0.4 }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <div style={{ fontWeight:600, marginBottom:'4px', fontSize:'0.9rem' }}>No {filter === 'all' ? '' : filter} alerts</div>
          <div style={{ fontSize:'0.78rem' }}>Run the migration SQL from the Canvas panel to add triggers and seed data</div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {displayed.map(a => {
          const cfg = TYPE_CONFIG[a.alert_type] ?? TYPE_CONFIG.low_sync
          const status = getStatus(a)
          const isActing = acting === a.id
          const isFlash = flash?.id === a.id
          const sev = a.recipients && typeof a.recipients === 'object' && 'severity' in a.recipients
            ? (a.recipients as Record<string,unknown>).severity as number
            : a.severity

          return (
            <div key={a.id}
              style={{ background: isFlash ? (flash?.type === 'ack' ? 'rgba(245,158,11,0.05)' : 'rgba(34,197,94,0.05)') : cfg.bg,
                border: `1px solid ${isFlash ? (flash?.type === 'ack' ? 'rgba(245,158,11,0.4)' : 'rgba(34,197,94,0.4)') : cfg.border}`,
                borderRadius:'10px', padding:'16px 18px', transition:'all 300ms',
                opacity: status === 'resolved' ? 0.65 : 1,
                borderLeft: `4px solid ${cfg.color}`,
              }}
            >
              <div style={{ display:'flex', gap:'12px', alignItems:'flex-start' }}>
                {/* Icon */}
                <div style={{ width:'34px', height:'34px', borderRadius:'8px', background:`${cfg.color}18`, border:`1px solid ${cfg.color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'1px' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={cfg.svgPath}/>
                  </svg>
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'10px', marginBottom:'4px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'7px', flexWrap:'wrap', marginBottom:'3px' }}>
                        <span style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', padding:'1px 7px', borderRadius:'3px', background:`${cfg.color}15`, border:`1px solid ${cfg.color}30`, color:cfg.color }}>{cfg.label}</span>
                        {sev && <span style={{ fontSize:'0.65rem', fontWeight:700, padding:'1px 6px', borderRadius:'3px', background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>Severity {sev}/5</span>}
                        {status === 'new'          && <span style={{ fontSize:'0.6rem', fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', padding:'1px 6px', borderRadius:'3px' }}>NEW</span>}
                        {status === 'acknowledged' && <span style={{ fontSize:'0.6rem', fontWeight:700, color:'#f59e0b', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', padding:'1px 6px', borderRadius:'3px' }}>ACK</span>}
                        {status === 'resolved'     && <span style={{ fontSize:'0.6rem', fontWeight:700, color:'#22c55e', background:'rgba(34,197,94,0.1)',  border:'1px solid rgba(34,197,94,0.3)',  padding:'1px 6px', borderRadius:'3px' }}>RESOLVED</span>}
                      </div>
                      <div style={{ fontSize:'0.9rem', fontWeight:700, color:'var(--text)', marginBottom:'4px' }}>{a.title}</div>
                      <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', lineHeight:1.5 }}>{a.message}</div>
                    </div>
                    {/* Timestamp */}
                    <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', flexShrink:0, textAlign:'right' }}>
                      {new Date(a.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                      <br/>
                      {new Date(a.created_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
                    </div>
                  </div>

                  {/* Meta info */}
                  <div style={{ display:'flex', gap:'12px', marginTop:'8px', marginBottom:'10px', flexWrap:'wrap' }}>
                    {a.gps_lat && a.gps_lng && (
                      <span style={{ fontSize:'0.68rem', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'4px' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
                        {(a.gps_lat as number).toFixed(4)}°N, {(a.gps_lng as number).toFixed(4)}°W
                      </span>
                    )}
                    {a.related_table && a.related_table !== '__resolved__' && (
                      <span style={{ fontSize:'0.68rem', color:'var(--text-muted)' }}>Source: {a.related_table.replace(/_/g,' ')}</span>
                    )}
                    {status === 'acknowledged' && a.recipients?.acknowledged_at && (
                      <span style={{ fontSize:'0.68rem', color:'#f59e0b' }}>Acknowledged {new Date(a.recipients.acknowledged_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}</span>
                    )}
                    {status === 'resolved' && a.recipients?.resolved_at && (
                      <span style={{ fontSize:'0.68rem', color:'#22c55e' }}>Resolved {new Date(a.recipients.resolved_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                    {status === 'new' && (
                      <>
                        <button onClick={() => acknowledge(a.id)} disabled={isActing}
                          style={{ padding:'6px 14px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.35)', borderRadius:'6px', cursor:isActing ? 'not-allowed' : 'pointer', fontSize:'0.75rem', fontWeight:600, color:'#f59e0b', transition:'all 150ms', display:'flex', alignItems:'center', gap:'5px' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          {isActing ? 'Working…' : 'Acknowledge'}
                        </button>
                        <button onClick={() => resolve(a.id)} disabled={isActing}
                          style={{ padding:'6px 14px', background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:'6px', cursor:isActing ? 'not-allowed' : 'pointer', fontSize:'0.75rem', fontWeight:600, color:'#22c55e', transition:'all 150ms', display:'flex', alignItems:'center', gap:'5px' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          {isActing ? 'Working…' : 'Mark Resolved'}
                        </button>
                      </>
                    )}
                    {status === 'acknowledged' && (
                      <>
                        <button onClick={() => resolve(a.id)} disabled={isActing}
                          style={{ padding:'6px 14px', background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:'6px', cursor:isActing ? 'not-allowed' : 'pointer', fontSize:'0.75rem', fontWeight:600, color:'#22c55e', transition:'all 150ms' }}>
                          {isActing ? 'Working…' : 'Mark Resolved'}
                        </button>
                        <button onClick={() => reopen(a.id)} disabled={isActing}
                          style={{ padding:'6px 12px', background:'transparent', border:'1px solid var(--border)', borderRadius:'6px', cursor:isActing ? 'not-allowed' : 'pointer', fontSize:'0.72rem', color:'var(--text-muted)' }}>
                          Reopen
                        </button>
                      </>
                    )}
                    {status === 'resolved' && (
                      <button onClick={() => reopen(a.id)} disabled={isActing}
                        style={{ padding:'5px 12px', background:'transparent', border:'1px solid var(--border)', borderRadius:'6px', cursor:isActing ? 'not-allowed' : 'pointer', fontSize:'0.72rem', color:'var(--text-muted)' }}>
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes livePulse { 0%,100% { opacity:.5; } 50% { opacity:1; } }
      `}</style>
    </div>
  )
}




