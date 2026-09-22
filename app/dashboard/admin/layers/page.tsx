'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'

// Lazy-load uploader (uses shpjs which is large)
const ShapefileUploader = dynamic(() => import('@/components/map/ShapefileUploader'), { ssr: false })

interface ParkLayer {
  id: string
  name: string
  description: string | null
  color: string
  opacity: number
  is_visible: boolean
  file_name: string | null
  feature_count: number | null
  created_at: string
  updated_at: string
}

const MANAGER_ROLES = ['system_admin', 'park_manager']
const ADMIN_ROLES   = ['system_admin']

// ── Debounce helper ──────────────────────────────────────────────────────────
function useDebounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback((...args: Parameters<T>) => {
    if (ref.current) clearTimeout(ref.current)
    ref.current = setTimeout(() => fn(...args), delay)
  }, [fn, delay]) as T
}

// ── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
        background: checked ? '#00bcd4' : 'rgba(255,255,255,0.1)',
        position: 'relative', transition: 'background 200ms', flexShrink: 0,
        boxShadow: checked ? '0 0 8px rgba(0,188,212,0.4)' : 'none',
      }}
    >
      <span style={{
        position: 'absolute', top: '3px',
        left: checked ? '23px' : '3px',
        width: '18px', height: '18px', borderRadius: '50%',
        background: '#fff', transition: 'left 200ms',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

export default function LayerManagementPage() {
  const router  = useRouter()
  const [userRole,     setUserRole]     = useState<string | null>(null)
  const [layers,       setLayers]       = useState<ParkLayer[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [renamingId,   setRenamingId]   = useState<string | null>(null)
  const [renameVal,    setRenameVal]    = useState('')
  const [liveEvent,    setLiveEvent]    = useState<string | null>(null)
  const [showUpload,   setShowUpload]   = useState(false)
  const [savingIds,    setSavingIds]    = useState<Set<string>>(new Set())
  const [bulkStatus,   setBulkStatus]   = useState<string | null>(null)

  // ── Auth check ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
      const role = p?.role ?? null
      setUserRole(role)
      if (!role) { router.push('/'); return }
    }
    init()
  }, [router])

  // ── Fetch layers ──────────────────────────────────────────────────────────
  const fetchLayers = useCallback(async () => {
    const sb = createClient()
    const { data } = await sb.from('park_layers').select('*').order('name')
    setLayers((data ?? []) as ParkLayer[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchLayers() }, [fetchLayers])

  // ── Realtime subscription — syncs changes across ALL devices ───────────────
  useEffect(() => {
    const sb = createClient()
    const channel = sb.channel('layer-admin-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'park_layers' }, payload => {
        if (payload.eventType === 'INSERT') {
          setLayers(prev => [...prev, payload.new as ParkLayer].sort((a, b) => a.name.localeCompare(b.name)))
          setLiveEvent(`Layer added: ${(payload.new as ParkLayer).name}`)
        } else if (payload.eventType === 'UPDATE') {
          setLayers(prev => prev.map(l => l.id === payload.new.id ? { ...l, ...payload.new } : l))
          setLiveEvent(`Updated: ${(payload.new as ParkLayer).name}`)
        } else if (payload.eventType === 'DELETE') {
          setLayers(prev => prev.filter(l => l.id !== payload.old.id))
          setLiveEvent('Layer removed')
        }
        setTimeout(() => setLiveEvent(null), 3000)
      })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [])

  // ── Update helpers ────────────────────────────────────────────────────────
  const canEdit = MANAGER_ROLES.includes(userRole ?? '')
  const isAdmin = ADMIN_ROLES.includes(userRole ?? '')

  function optimisticUpdate(id: string, changes: Partial<ParkLayer>) {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...changes } : l))
  }

  async function persist(id: string, changes: Partial<ParkLayer>) {
    setSavingIds(prev => new Set(prev).add(id))
    const sb = createClient()
    await sb.from('park_layers').update(changes).eq('id', id)
    setSavingIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  const debouncedPersist = useDebounce(persist, 600)

  function handleToggle(id: string, current: boolean) {
    optimisticUpdate(id, { is_visible: !current })
    persist(id, { is_visible: !current })
  }

  function handleColor(id: string, color: string) {
    optimisticUpdate(id, { color })
    debouncedPersist(id, { color })
  }

  function handleOpacity(id: string, opacity: number) {
    optimisticUpdate(id, { opacity })
    debouncedPersist(id, { opacity })
  }

  function startRename(layer: ParkLayer) {
    if (!canEdit) return
    setRenamingId(layer.id)
    setRenameVal(layer.name)
  }

  async function commitRename(id: string) {
    const trimmed = renameVal.trim()
    if (trimmed && trimmed !== layers.find(l => l.id === id)?.name) {
      optimisticUpdate(id, { name: trimmed })
      await persist(id, { name: trimmed })
    }
    setRenamingId(null)
  }

  async function deleteLayer(id: string, name: string) {
    if (!isAdmin) return
    if (!confirm(`Delete layer “${name}”? This cannot be undone.`)) return
    const sb = createClient()
    await sb.from('park_layers').delete().eq('id', id)
    setLayers(prev => prev.filter(l => l.id !== id))
  }

  async function bulkToggle(visible: boolean) {
    setBulkStatus(visible ? 'Showing all layers…' : 'Hiding all layers…')
    const sb = createClient()
    await sb.from('park_layers').update({ is_visible: visible }).neq('id', '00000000-0000-0000-0000-000000000000')
    setLayers(prev => prev.map(l => ({ ...l, is_visible: visible })))
    setBulkStatus(null)
  }

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = layers.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    (l.file_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const visibleCount = layers.filter(l => l.is_visible).length

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text-muted)', gap:'10px', fontSize:'0.85rem' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-18 0"/></svg>
      Loading layers…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding:'28px', maxWidth:'1200px', fontFamily:'var(--font-jakarta)' }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'24px', gap:'16px', flexWrap:'wrap' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
            <h1 style={{ fontSize:'22px', fontWeight:'800', color:'#fff', letterSpacing:'-0.3px' }}>GIS Layer Management</h1>
            {/* Live sync badge */}
            <div style={{ display:'flex', alignItems:'center', gap:'5px', padding:'3px 9px', borderRadius:'20px', background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)' }}>
              <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#10b981', animation:'livePulse 2s ease-in-out infinite', display:'inline-block' }} />
              <span style={{ fontSize:'11px', fontWeight:'700', color:'#10b981', letterSpacing:'0.5px' }}>LIVE SYNC</span>
            </div>
          </div>
          <p style={{ fontSize:'13px', color:'#5a7d94' }}>Changes sync instantly to all devices viewing the Park Map</p>
          {liveEvent && (
            <div style={{ marginTop:'6px', display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'#00bcd4' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              {liveEvent}
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
          {canEdit && (
            <>
              <button onClick={() => bulkToggle(true)} style={{ padding:'8px 14px', border:'1px solid rgba(16,185,129,0.4)', borderRadius:'8px', background:'rgba(16,185,129,0.08)', color:'#10b981', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                Show All
              </button>
              <button onClick={() => bulkToggle(false)} style={{ padding:'8px 14px', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'8px', background:'rgba(255,255,255,0.04)', color:'#7aa3be', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                Hide All
              </button>
            </>
          )}
          {isAdmin && (
            <button onClick={() => setShowUpload(!showUpload)}
              style={{ padding:'8px 16px', background:'linear-gradient(135deg,#00bcd4,#0077a8)', border:'none', borderRadius:'8px', color:'#fff', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'6px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              Upload Shapefile
            </button>
          )}
        </div>
      </div>

      {/* ── Upload panel ── */}
      {showUpload && isAdmin && (
        <div style={{ marginBottom:'24px', background:'rgba(0,188,212,0.05)', border:'1px solid rgba(0,188,212,0.2)', borderRadius:'14px', padding:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
            <div style={{ fontSize:'14px', fontWeight:'700', color:'#00bcd4' }}>Upload New Shapefile Layer</div>
            <button onClick={() => setShowUpload(false)} style={{ background:'none', border:'none', color:'#5a7d94', cursor:'pointer', fontSize:'18px' }}>×</button>
          </div>
          <ShapefileUploader onDone={() => { setShowUpload(false); fetchLayers() }} />
        </div>
      )}

      {/* ── Stats row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:'12px', marginBottom:'24px' }}>
        {[
          { label:'Total Layers', val: layers.length, color:'#00bcd4' },
          { label:'Visible',      val: visibleCount,  color:'#10b981' },
          { label:'Hidden',       val: layers.length - visibleCount, color:'#6b7280' },
          { label:'Total Features', val: layers.reduce((a, l) => a + (l.feature_count ?? 0), 0).toLocaleString(), color:'#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'14px', textAlign:'center' }}>
            <div style={{ fontSize:'22px', fontWeight:'800', color:s.color, marginBottom:'3px', fontVariantNumeric:'tabular-nums' }}>{s.val}</div>
            <div style={{ fontSize:'11px', color:'#5a7d94', textTransform:'uppercase', letterSpacing:'0.5px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Search ── */}
      <div style={{ marginBottom:'20px' }}>
        <div style={{ position:'relative', maxWidth:'340px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a7d94" strokeWidth="2" style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            placeholder="Search layers…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width:'100%', padding:'9px 12px 9px 36px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', color:'#e2f0f9', fontSize:'13px', outline:'none', fontFamily:'inherit' }}
          />
        </div>
        {search && <div style={{ marginTop:'6px', fontSize:'12px', color:'#5a7d94' }}>{filtered.length} of {layers.length} layers</div>}
      </div>

      {/* ── Bulk status ── */}
      {bulkStatus && (
        <div style={{ marginBottom:'16px', padding:'10px 14px', background:'rgba(0,188,212,0.08)', border:'1px solid rgba(0,188,212,0.2)', borderRadius:'8px', fontSize:'13px', color:'#00bcd4', display:'flex', alignItems:'center', gap:'8px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-18 0"/></svg>
          {bulkStatus}
        </div>
      )}

      {/* ── Layer grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:'14px' }}>
        {filtered.map(layer => {
          const isSaving = savingIds.has(layer.id)
          return (
            <div key={layer.id} style={{
              background:'rgba(255,255,255,0.03)',
              border:'1px solid rgba(255,255,255,0.07)',
              borderLeft:`4px solid ${layer.color}`,
              borderRadius:'12px', padding:'16px 18px',
              position:'relative', overflow:'hidden',
              transition:'border-color 200ms',
            }}>
              {/* Saving indicator */}
              {isSaving && (
                <div style={{ position:'absolute', top:'10px', right:'10px', width:'6px', height:'6px', borderRadius:'50%', background:'#f59e0b', animation:'livePulse 1s ease-in-out infinite' }} />
              )}

              {/* Row 1: Color swatch + Name + Toggle */}
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
                {/* Color picker */}
                <div style={{ position:'relative', flexShrink:0 }}>
                  <div style={{ width:'28px', height:'28px', borderRadius:'7px', background:layer.color, border:'2px solid rgba(255,255,255,0.15)', cursor: canEdit ? 'pointer' : 'default', overflow:'hidden', position:'relative' }}>
                    {canEdit && (
                      <input
                        type="color"
                        value={layer.color}
                        onChange={e => handleColor(layer.id, e.target.value)}
                        disabled={!canEdit}
                        style={{ position:'absolute', inset:'-4px', width:'calc(100% + 8px)', height:'calc(100% + 8px)', opacity:0, cursor:'pointer' }}
                        title="Change colour"
                      />
                    )}
                  </div>
                </div>

                {/* Layer name */}
                <div style={{ flex:1, minWidth:0 }}>
                  {renamingId === layer.id ? (
                    <input
                      autoFocus
                      value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      onBlur={() => commitRename(layer.id)}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(layer.id); if (e.key === 'Escape') setRenamingId(null) }}
                      style={{ width:'100%', fontSize:'14px', fontWeight:'700', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(0,188,212,0.5)', borderRadius:'5px', color:'#e2f0f9', padding:'3px 7px', outline:'none', fontFamily:'inherit' }}
                    />
                  ) : (
                    <div
                      onClick={() => startRename(layer)}
                      title={canEdit ? 'Click to rename' : layer.name}
                      style={{ fontSize:'14px', fontWeight:'700', color:'#e2f0f9', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor: canEdit ? 'text' : 'default' }}
                    >
                      {layer.name}
                    </div>
                  )}
                  {layer.file_name && (
                    <div style={{ fontSize:'11px', color:'#3d6b84', marginTop:'1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{layer.file_name}</div>
                  )}
                </div>

                {/* Visibility toggle */}
                <Toggle checked={layer.is_visible} onChange={v => canEdit ? handleToggle(layer.id, layer.is_visible) : undefined} />
              </div>

              {/* Feature count + status badges */}
              <div style={{ display:'flex', gap:'6px', marginBottom:'12px', flexWrap:'wrap' }}>
                {layer.feature_count !== null && (
                  <span style={{ padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:'600', background:'rgba(255,255,255,0.06)', color:'#7aa3be' }}>
                    {layer.feature_count} feature{layer.feature_count !== 1 ? 's' : ''}
                  </span>
                )}
                <span style={{ padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:'600', background: layer.is_visible ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)', color: layer.is_visible ? '#10b981' : '#6b7280' }}>
                  {layer.is_visible ? 'Visible' : 'Hidden'}
                </span>
              </div>

              {/* Opacity slider */}
              {canEdit && (
                <div style={{ marginBottom:'12px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                    <span style={{ fontSize:'11px', color:'#5a7d94', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.4px' }}>Opacity</span>
                    <span style={{ fontSize:'12px', fontWeight:'700', color: layer.color, fontFamily:'monospace' }}>{Math.round(layer.opacity * 100)}%</span>
                  </div>
                  <div style={{ position:'relative', height:'20px', display:'flex', alignItems:'center' }}>
                    {/* Track */}
                    <div style={{ position:'absolute', left:0, right:0, height:'4px', borderRadius:'2px', background:`linear-gradient(to right, ${layer.color}80, ${layer.color})` }} />
                    <input
                      type="range" min="0.05" max="1" step="0.05" value={layer.opacity}
                      onChange={e => handleOpacity(layer.id, parseFloat(e.target.value))}
                      style={{ width:'100%', accentColor: layer.color, cursor:'pointer', position:'relative', background:'transparent' }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:'8px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display:'flex', gap:'8px' }}>
                  {/* View on map */}
                  <a href="/dashboard/maps" target="_blank" rel="noopener" title="View on map"
                    style={{ display:'flex', alignItems:'center', gap:'5px', padding:'5px 10px', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'6px', background:'rgba(255,255,255,0.03)', color:'#7aa3be', fontSize:'11px', fontWeight:'600', textDecoration:'none' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6-3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-1.447-.894L15 9m0 8V9m0 0L9 7"/></svg>
                    Map
                  </a>
                  {canEdit && (
                    <button onClick={() => startRename(layer)}
                      title="Rename layer"
                      style={{ display:'flex', alignItems:'center', gap:'5px', padding:'5px 10px', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'6px', background:'rgba(255,255,255,0.03)', color:'#7aa3be', fontSize:'11px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Rename
                    </button>
                  )}
                </div>

                {isAdmin && (
                  <button onClick={() => deleteLayer(layer.id, layer.name)}
                    title="Delete layer"
                    style={{ display:'flex', alignItems:'center', gap:'5px', padding:'5px 10px', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'6px', background:'rgba(239,68,68,0.06)', color:'#f87171', fontSize:'11px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                    Delete
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div style={{ textAlign:'center', padding:'60px 32px', color:'#5a7d94', fontSize:'14px' }}>
          {search ? `No layers matching “${search}”` : 'No GIS layers in the database yet.'}
        </div>
      )}

      {/* Read-only notice for non-managers */}
      {!canEdit && userRole && (
        <div style={{ marginTop:'24px', padding:'12px 16px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', fontSize:'12px', color:'#5a7d94', textAlign:'center' }}>
          You have read-only access to layer configuration. Contact a Park Manager or System Admin to make changes.
        </div>
      )}

      <style>{`
        @keyframes livePulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

