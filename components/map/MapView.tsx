'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, GeoJSON, useMapEvents, ZoomControl } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { divIcon } from 'leaflet'
import { createClient } from '@/lib/supabase/client'

// ── Data types ────────────────────────────────────────────────
interface Station  { id: string; station_code: string; name: string; lat: number; lng: number; station_type: string }
interface Heritage { id: string; site_code: string; name: string; lat: number; lng: number; current_condition: number; site_type: string }
interface Patrol   { id: string; ranger_id: string; patrol_type: string; start_lat: number; start_lng: number; end_lat: number | null; end_lng: number | null; start_time: string; is_active: boolean; sector: string | null; profiles?: { full_name: string } | null }
interface CSReport { id: string; report_type: string; species_type: string | null; incident_type: string | null; severity: number | null; gps_lat: number; gps_lng: number; validation_status: string; created_at: string; behavior: string | null }

// ── Park GIS layer ───────────────────────────────────────────
interface ParkLayer {
  id: string
  name: string
  description: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geojson: any
  color: string
  opacity: number
  is_visible: boolean
  created_at: string
  file_name: string | null
  feature_count: number | null
}

// ── Custom SVG divIcons ───────────────────────────────────────
function makeIcon(svgPath: string, bg: string, border: string, size = 32) {
  return divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2px solid ${border};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);">
      <svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>
    </div>`,
    className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -(size / 2 + 4)],
  })
}

const ICONS = {
  station_coral:   makeIcon('<path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12"/><path d="M12 8v4l3 3"/>', '#0d9488', '#0f766e'),
  station_wq:      makeIcon('<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>', '#0891b2', '#0e7490'),
  station_fish:    makeIcon('<path d="M6.5 12c0 1.1.4 2.1 1.1 2.8L3 19l4.2-4.2c.7.7 1.7 1.2 2.8 1.2 2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4z"/>', '#06b6d4', '#0891b2'),
  station_multi:   makeIcon('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>', '#6366f1', '#4f46e5'),
  heritage_1:      makeIcon('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', '#dc2626', '#b91c1c'),
  heritage_2:      makeIcon('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', '#ea580c', '#c2410c'),
  heritage_3:      makeIcon('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', '#d97706', '#b45309'),
  heritage_4:      makeIcon('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', '#16a34a', '#15803d'),
  heritage_5:      makeIcon('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', '#0d9488', '#0f766e'),
  patrol_start:    makeIcon('<circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>', '#3b82f6', '#2563eb'),
  patrol_active:   makeIcon('<circle cx="12" cy="10" r="3"/><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>', '#4fb3e8', '#0284c7'),
  wildlife:        makeIcon('<path d="M2 12a10 10 0 1 0 20 0A10 10 0 0 0 2 12z"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/>', '#16a34a', '#15803d', 28),
  incident_1:      makeIcon('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/>', '#84cc16', '#65a30d', 28),
  incident_2:      makeIcon('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/>', '#f59e0b', '#d97706', 30),
  incident_3:      makeIcon('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/>', '#f97316', '#ea580c', 32),
  incident_4:      makeIcon('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/>', '#ef4444', '#dc2626', 34),
  incident_5:      makeIcon('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/>', '#dc2626', '#991b1b', 36),
}

function getStationIcon(type: string) {
  if (type === 'coral') return ICONS.station_coral
  if (type === 'water_quality') return ICONS.station_wq
  if (type === 'fish') return ICONS.station_fish
  return ICONS.station_multi
}
function getHeritageIcon(condition: number) {
  return ICONS[`heritage_${Math.min(5, Math.max(1, condition)) as 1|2|3|4|5}` as keyof typeof ICONS] ?? ICONS.heritage_3
}
function getIncidentIcon(severity: number) {
  return ICONS[`incident_${Math.min(5, Math.max(1, severity)) as 1|2|3|4|5}` as keyof typeof ICONS] ?? ICONS.incident_3
}

// ── Coordinate display child component ───────────────────────
function CoordTracker({ onCoords }: { onCoords: (lat: number, lng: number) => void }) {
  useMapEvents({ mousemove: e => onCoords(e.latlng.lat, e.latlng.lng) })
  return null
}

// ── English Harbour, Antigua — 17.0058°N, 61.7641°W ──────────
const PARK_CENTER: [number, number] = [17.0058, -61.7641]
const PARK_ZOOM = 13

// ── Main MapView component ────────────────────────────────────
export default function MapView() {
  const [stations,  setStations]  = useState<Station[]>([])
  const [heritage,  setHeritage]  = useState<Heritage[]>([])
  const [patrols,   setPatrols]   = useState<Patrol[]>([])
  const [wildlife,  setWildlife]  = useState<CSReport[]>([])
  const [incidents, setIncidents] = useState<CSReport[]>([])
  const [loading,   setLoading]   = useState(true)
  const [coords,    setCoords]    = useState<[number,number] | null>(null)
  const [newAlert,  setNewAlert]  = useState<string | null>(null)

  // Layer visibility toggles
  const [show, setShow] = useState({
    stations: true, heritage: true, patrols: true, wildlife: true, incidents: true
  })
  const toggle = (k: keyof typeof show) => setShow(p => ({...p, [k]: !p[k]}))

  // ── GIS (shapefile) layers ───────────────────────────────────
  const [parkLayers,     setParkLayers]     = useState<ParkLayer[]>([])
  const [userRole,       setUserRole]       = useState<string | null>(null)
  const [uploading,      setUploading]      = useState(false)
  const [uploadStatus,   setUploadStatus]   = useState('')
  const [layerError,     setLayerError]     = useState('')
  const [renamingId,     setRenamingId]     = useState<string | null>(null)
  const [renameVal,      setRenameVal]      = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check role
  useEffect(() => {
    async function checkRole() {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (user) {
        const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
        setUserRole(p?.role ?? null)
      }
    }
    checkRole()
  }, [])

  // Fetch GIS layers
  const fetchLayers = useCallback(async () => {
    const sb = createClient()
    const { data } = await sb.from('park_layers').select('*').order('created_at', { ascending: false })
    setParkLayers((data ?? []) as ParkLayer[])
  }, [])

  useEffect(() => { fetchLayers() }, [fetchLayers])

  // Handle shapefile ZIP upload
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setLayerError('')
    setUploadStatus('Parsing shapefile…')

    try {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        throw new Error('Upload a ZIP file containing .shp, .dbf, and .shx files.')
      }

      // Dynamic import — shpjs is large, only load when needed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shpjs = (await import('shpjs')).default as any
      const buf   = await file.arrayBuffer()
      const raw   = await shpjs(buf)

      // shpjs may return a single FeatureCollection or an array
      const collection = Array.isArray(raw) ? raw[0] : raw
      const featureCount: number = collection?.features?.length ?? 0

      if (!collection || !collection.type) throw new Error('Could not parse GeoJSON from shapefile.')

      setUploadStatus('Saving layer…')
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      const layerName = file.name.replace(/\.zip$/i, '').replace(/[_-]/g, ' ')

      const { error } = await sb.from('park_layers').insert({
        name:          layerName,
        geojson:       collection,
        color:         '#00bcd4',
        opacity:       0.5,
        is_visible:    true,
        created_by:    user?.id,
        file_name:     file.name,
        feature_count: featureCount,
      })

      if (error) throw new Error(error.message)

      setUploadStatus(`✓ Added “${layerName}” (${featureCount} features)`)
      await fetchLayers()
      setTimeout(() => setUploadStatus(''), 4000)
    } catch (err) {
      setLayerError(err instanceof Error ? err.message : 'Upload failed.')
      setUploadStatus('')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function deleteLayer(id: string) {
    if (!confirm('Delete this layer from the map?')) return
    const sb = createClient()
    await sb.from('park_layers').delete().eq('id', id)
    setParkLayers(p => p.filter(l => l.id !== id))
  }

  async function toggleLayerVisible(id: string, current: boolean) {
    const sb = createClient()
    await sb.from('park_layers').update({ is_visible: !current }).eq('id', id)
    setParkLayers(p => p.map(l => l.id === id ? { ...l, is_visible: !current } : l))
  }

  async function updateLayerColor(id: string, color: string) {
    const sb = createClient()
    await sb.from('park_layers').update({ color }).eq('id', id)
    setParkLayers(p => p.map(l => l.id === id ? { ...l, color } : l))
  }

  async function updateLayerOpacity(id: string, opacity: number) {
    const sb = createClient()
    await sb.from('park_layers').update({ opacity }).eq('id', id)
    setParkLayers(p => p.map(l => l.id === id ? { ...l, opacity } : l))
  }

  async function renameLayer(id: string, name: string) {
    const sb = createClient()
    await sb.from('park_layers').update({ name }).eq('id', id)
    setParkLayers(p => p.map(l => l.id === id ? { ...l, name } : l))
    setRenamingId(null)
  }

  // ── Fetch all map data ──────────────────────────────────────
  const fetchData = useCallback(async () => {
    const sb = createClient()
    const [s, h, p, cs] = await Promise.all([
      sb.from('monitoring_stations').select('id,station_code,name,lat,lng,station_type').eq('is_active', true),
      sb.from('heritage_sites').select('id,site_code,name,lat,lng,current_condition,site_type').eq('is_active', true),
      sb.from('patrol_logs').select('id,ranger_id,patrol_type,start_lat,start_lng,end_lat,end_lng,start_time,is_active,sector,profiles(full_name)').order('start_time', { ascending: false }).limit(50),
      sb.from('citizen_science_reports').select('id,report_type,species_type,incident_type,severity,gps_lat,gps_lng,validation_status,created_at,behavior').order('created_at', { ascending: false }).limit(200),
    ])
    setStations((s.data ?? []) as unknown as Station[])
    setHeritage((h.data ?? []) as unknown as Heritage[])
    setPatrols((p.data ?? []) as unknown as Patrol[])
    const csData = (cs.data ?? []) as unknown as CSReport[]
    setWildlife(csData.filter(r => r.report_type === 'wildlife_sighting'))
    setIncidents(csData.filter(r => r.report_type === 'environmental_incident'))
    setLoading(false)
  }, [])

  // ── Realtime subscription ───────────────────────────────────
  useEffect(() => {
    fetchData()
    const sb = createClient()
    const channel = sb.channel('map-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'citizen_science_reports' }, payload => {
        const r = payload.new as unknown as CSReport
        if (r.report_type === 'wildlife_sighting') {
          setWildlife(p => [r, ...p])
          setNewAlert(`New wildlife sighting: ${r.species_type ?? 'Unknown species'}`)
        } else {
          setIncidents(p => [r, ...p])
          if ((r.severity ?? 0) >= 4) setNewAlert(`⚠ High-severity incident: ${r.incident_type ?? 'Unknown'} (severity ${r.severity})`)
          else setNewAlert(`New incident report: ${r.incident_type ?? 'Unknown'}`)
        }
        setTimeout(() => setNewAlert(null), 6000)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'patrol_logs' }, payload => {
        setPatrols(p => [payload.new as unknown as Patrol, ...p])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'park_layers' }, () => { fetchLayers() })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [fetchData, fetchLayers])

  const COND       = ['', 'Critical', 'Poor', 'Fair', 'Good', 'Excellent']
  const COND_COLOR = ['', '#ef4444', '#ea580c', '#f59e0b', '#22c55e', '#0d9488']
  const isAdmin    = userRole === 'system_admin'

  if (loading) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', color:'var(--text-muted)', fontSize:'0.85rem', gap:'10px' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"/></svg>
      Loading map data…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ display:'flex', width:'100%', height:'100%', position:'relative' }}>

      {/* ════════════ Left control panel ════════════ */}
      <div style={{ width:'260px', background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflowY:'auto', flexShrink:0, zIndex:1000 }}>

        {/* Real-time alert */}
        {newAlert && (
          <div style={{ padding:'10px 14px', background:'rgba(239,68,68,0.1)', borderBottom:'1px solid rgba(239,68,68,0.25)', fontSize:'0.72rem', color:'#fca5a5', lineHeight:1.5 }}>
            <div style={{ fontWeight:700, marginBottom:'2px', color:'#ef4444' }}>● Live Update</div>
            {newAlert}
          </div>
        )}

        {/* ── Standard map layer toggles ── */}
        <div style={{ padding:'14px' }}>
          <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'10px' }}>Map Layers</div>
          {([
            { key:'stations' as const,  label:'Monitoring Stations', color:'#0d9488', count: stations.length },
            { key:'heritage' as const,  label:'Heritage Sites',       color:'#f59e0b', count: heritage.length },
            { key:'patrols'  as const,  label:'Patrol Routes',        color:'#4fb3e8', count: patrols.length },
            { key:'wildlife' as const,  label:'Wildlife Sightings',   color:'#22c55e', count: wildlife.length },
            { key:'incidents' as const, label:'Incidents',            color:'#ef4444', count: incidents.length },
          ] as const).map(layer => (
            <button key={layer.key} onClick={() => toggle(layer.key)}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:'9px', padding:'8px 10px', borderRadius:'7px', border:'none', background: show[layer.key] ? `${layer.color}14` : 'transparent', cursor:'pointer', marginBottom:'3px', transition:'all 150ms', textAlign:'left' }}>
              <div style={{ width:'14px', height:'14px', borderRadius:'3px', background: show[layer.key] ? layer.color : 'var(--border)', flexShrink:0, transition:'background 150ms' }} />
              <div style={{ flex:1, fontSize:'0.78rem', fontWeight:600, color: show[layer.key] ? 'var(--text)' : 'var(--text-muted)' }}>{layer.label}</div>
              <div style={{ fontSize:'0.65rem', fontWeight:700, color: show[layer.key] ? layer.color : 'var(--text-muted)', background: show[layer.key] ? `${layer.color}18` : 'var(--surface2)', border:`1px solid ${show[layer.key] ? `${layer.color}30` : 'var(--border)'}`, borderRadius:'4px', padding:'1px 6px' }}>{layer.count}</div>
            </button>
          ))}
        </div>

        {/* ── GIS / Shapefile layers ── */}
        <div style={{ padding:'0 14px 14px', borderTop:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:'12px', marginBottom:'10px' }}>
            <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-muted)' }}>GIS Layers</div>
            {isAdmin && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  style={{ display:'none' }}
                  onChange={handleUpload}
                />
                <button
                  onClick={() => { setLayerError(''); fileInputRef.current?.click() }}
                  disabled={uploading}
                  title="Upload Shapefile ZIP"
                  style={{ padding:'4px 8px', borderRadius:'5px', border:'1px solid rgba(0,188,212,0.4)', background:'rgba(0,188,212,0.08)', color:'#00bcd4', fontSize:'0.65rem', fontWeight:700, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1, display:'flex', alignItems:'center', gap:'4px', fontFamily:'inherit' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                  {uploading ? 'Uploading…' : 'Upload .zip'}
                </button>
              </>
            )}
          </div>

          {/* Upload status / error */}
          {uploadStatus && (
            <div style={{ marginBottom:'8px', padding:'7px 10px', background:'rgba(0,188,212,0.08)', border:'1px solid rgba(0,188,212,0.25)', borderRadius:'6px', fontSize:'0.7rem', color:'#00bcd4' }}>
              {uploadStatus}
            </div>
          )}
          {layerError && (
            <div style={{ marginBottom:'8px', padding:'7px 10px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'6px', fontSize:'0.7rem', color:'#f87171' }}>
              {layerError}
            </div>
          )}

          {/* No layers message */}
          {parkLayers.length === 0 && (
            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', padding:'8px 6px', lineHeight:1.5 }}>
              {isAdmin ? 'Upload a shapefile ZIP to add a GIS overlay layer.' : 'No GIS layers uploaded yet.'}
            </div>
          )}

          {/* Layer list */}
          {parkLayers.map(layer => (
            <div key={layer.id} style={{ marginBottom:'10px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px', overflow:'hidden' }}>
              {/* Layer header */}
              <div style={{ display:'flex', alignItems:'center', gap:'7px', padding:'8px 10px' }}>
                {/* Visibility toggle */}
                <button onClick={() => toggleLayerVisible(layer.id, layer.is_visible)}
                  title={layer.is_visible ? 'Hide layer' : 'Show layer'}
                  style={{ width:'14px', height:'14px', borderRadius:'3px', border:'none', background: layer.is_visible ? layer.color : 'var(--border)', cursor:'pointer', flexShrink:0, transition:'background 150ms', padding:0 }} />

                {/* Name / rename */}
                {renamingId === layer.id ? (
                  <input
                    autoFocus
                    value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    onBlur={() => { if (renameVal.trim()) renameLayer(layer.id, renameVal.trim()); else setRenamingId(null) }}
                    onKeyDown={e => { if (e.key === 'Enter' && renameVal.trim()) renameLayer(layer.id, renameVal.trim()); if (e.key === 'Escape') setRenamingId(null) }}
                    style={{ flex:1, fontSize:'0.75rem', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(0,188,212,0.4)', borderRadius:'4px', color:'var(--text)', padding:'2px 6px', outline:'none', fontFamily:'inherit' }}
                  />
                ) : (
                  <span
                    onClick={() => isAdmin && (setRenamingId(layer.id), setRenameVal(layer.name))}
                    style={{ flex:1, fontSize:'0.75rem', fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor: isAdmin ? 'text' : 'default' }}
                    title={isAdmin ? 'Click to rename' : layer.name}
                  >
                    {layer.name}
                  </span>
                )}

                {/* Delete (admin only) */}
                {isAdmin && (
                  <button onClick={() => deleteLayer(layer.id)}
                    title="Delete layer"
                    style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'0', display:'flex', flexShrink:0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                  </button>
                )}
              </div>

              {/* Layer controls (admin only) */}
              {isAdmin && (
                <div style={{ padding:'6px 10px 8px', borderTop:'1px solid var(--border)', display:'grid', gridTemplateColumns:'auto 1fr', gap:'6px 10px', alignItems:'center' }}>
                  {/* Color */}
                  <span style={{ fontSize:'0.62rem', color:'var(--text-muted)', fontWeight:600 }}>Color</span>
                  <input type="color" value={layer.color}
                    onChange={e => updateLayerColor(layer.id, e.target.value)}
                    style={{ width:'32px', height:'18px', border:'none', borderRadius:'3px', cursor:'pointer', background:'none', padding:0 }} />

                  {/* Opacity */}
                  <span style={{ fontSize:'0.62rem', color:'var(--text-muted)', fontWeight:600 }}>Opacity</span>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                    <input type="range" min="0.05" max="1" step="0.05" value={layer.opacity}
                      onChange={e => updateLayerOpacity(layer.id, parseFloat(e.target.value))}
                      style={{ flex:1, accentColor: layer.color, cursor:'pointer' }} />
                    <span style={{ fontSize:'0.62rem', color:'var(--text-muted)', minWidth:'28px', textAlign:'right' }}>{Math.round(layer.opacity * 100)}%</span>
                  </div>

                  {/* Feature count */}
                  {layer.feature_count !== null && (
                    <>
                      <span style={{ fontSize:'0.62rem', color:'var(--text-muted)', fontWeight:600 }}>Features</span>
                      <span style={{ fontSize:'0.62rem', color:'var(--text-dim)' }}>{layer.feature_count}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Upload hint */}
          {isAdmin && (
            <div style={{ marginTop:'6px', fontSize:'0.62rem', color:'var(--text-muted)', lineHeight:1.6, padding:'0 2px' }}>
              Supports: .zip containing .shp + .dbf + .shx
            </div>
          )}
        </div>

        {/* ── Stats summary ── */}
        <div style={{ padding:'0 14px 14px', borderTop:'1px solid var(--border)' }}>
          <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'8px', paddingTop:'12px' }}>Summary</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
            {[
              { label:'Active Patrols', val: patrols.filter(p => p.is_active).length, color:'#4fb3e8' },
              { label:'High Severity', val: incidents.filter(i => (i.severity ?? 0) >= 4).length, color:'#ef4444' },
              { label:'Critical Sites', val: heritage.filter(h => h.current_condition <= 2).length, color:'#ea580c' },
              { label:'Pending CS', val: [...wildlife,...incidents].filter(r => r.validation_status === 'pending').length, color:'#f59e0b' },
            ].map(s => (
              <div key={s.label} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'6px', padding:'8px', textAlign:'center' }}>
                <div style={{ fontSize:'1.3rem', fontWeight:800, color:s.color, lineHeight:1 }}>{s.val}</div>
                <div style={{ fontSize:'0.58rem', color:'var(--text-muted)', marginTop:'2px', lineHeight:1.2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Heritage legend ── */}
        <div style={{ padding:'0 14px 14px', borderTop:'1px solid var(--border)' }}>
          <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'8px', paddingTop:'12px' }}>Heritage Condition</div>
          {[1,2,3,4,5].map(n => (
            <div key={n} style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'4px' }}>
              <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:COND_COLOR[n], flexShrink:0 }} />
              <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{n} — {COND[n]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════ Leaflet Map ════════════ */}
      <div style={{ flex:1, position:'relative' }}>
        <MapContainer
          center={PARK_CENTER}
          zoom={PARK_ZOOM}
          zoomControl={false}
          style={{ width:'100%', height:'100%', background:'#071524' }}
        >
          <ZoomControl position="bottomright" />
          <CoordTracker onCoords={(lat, lng) => setCoords([lat, lng])} />

          {/* Satellite tile layer via Esri */}
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            opacity={0.9}
          />
          {/* Road/label overlay */}
          <TileLayer
            attribution=''
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            opacity={0.7}
          />

          {/* ── GIS / Shapefile overlay layers ── */}
          {parkLayers
            .filter(l => l.is_visible)
            .map(layer => (
              <GeoJSON
                key={`${layer.id}-${layer.color}-${layer.opacity}`}
                data={layer.geojson}
                style={{
                  color:       layer.color,
                  fillColor:   layer.color,
                  weight:      2,
                  opacity:     0.9,
                  fillOpacity: layer.opacity,
                }}
                onEachFeature={(feature, leafletLayer) => {
                  if (feature.properties) {
                    const props = Object.entries(feature.properties)
                      .filter(([, v]) => v !== null && v !== undefined && v !== '')
                      .slice(0, 8)
                      .map(([k, v]) => `<tr><td style="color:#94a3b8;padding:2px 6px 2px 0;font-size:11px">${k}</td><td style="color:#e2e8f0;font-size:11px;font-weight:600">${v}</td></tr>`)
                      .join('')
                    leafletLayer.bindPopup(
                      `<div style="font-family:system-ui;min-width:160px">
                        <div style="font-weight:700;font-size:13px;color:${layer.color};margin-bottom:6px">${layer.name}</div>
                        ${props ? `<table style="border-collapse:collapse">${props}</table>` : '<div style="font-size:11px;color:#94a3b8">No attributes</div>'}
                      </div>`
                    )
                  }
                }}
              />
            ))
          }

          {/* ── Monitoring Stations ── */}
          {show.stations && stations.map(s => (
            <Marker key={s.id} position={[s.lat, s.lng]} icon={getStationIcon(s.station_type)}>
              <Popup>
                <div style={{ fontFamily:'system-ui', minWidth:'160px' }}>
                  <div style={{ fontWeight:700, fontSize:'13px', color:'#0d9488', marginBottom:'3px' }}>{s.station_code}</div>
                  <div style={{ fontWeight:600, fontSize:'12px', marginBottom:'5px' }}>{s.name}</div>
                  <div style={{ fontSize:'11px', color:'#64748b', textTransform:'capitalize' }}>{s.station_type.replace('_', ' ')} Station</div>
                  <div style={{ fontSize:'10px', color:'#94a3b8', marginTop:'4px' }}>{s.lat.toFixed(4)}°N, {s.lng.toFixed(4)}°W</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* ── Heritage Sites ── */}
          {show.heritage && heritage.map(h => (
            <Marker key={h.id} position={[h.lat, h.lng]} icon={getHeritageIcon(h.current_condition)}>
              <Popup>
                <div style={{ fontFamily:'system-ui', minWidth:'160px' }}>
                  <div style={{ fontWeight:700, fontSize:'13px', color:COND_COLOR[h.current_condition], marginBottom:'3px' }}>{h.site_code}</div>
                  <div style={{ fontWeight:600, fontSize:'12px', marginBottom:'5px' }}>{h.name}</div>
                  <div style={{ fontSize:'11px' }}>Condition: <b style={{ color:COND_COLOR[h.current_condition] }}>{h.current_condition}/5 — {COND[h.current_condition]}</b></div>
                  {h.site_type && <div style={{ fontSize:'11px', color:'#64748b', marginTop:'3px', textTransform:'capitalize' }}>{h.site_type.replace(/_/g,' ')}</div>}
                  <div style={{ fontSize:'10px', color:'#94a3b8', marginTop:'4px' }}>{h.lat.toFixed(4)}°N, {h.lng.toFixed(4)}°W</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* ── Patrol Routes ── */}
          {show.patrols && patrols.map(p => {
            const hasRoute = p.end_lat && p.end_lng
            const positions: [number,number][] = hasRoute
              ? [[p.start_lat, p.start_lng], [p.end_lat!, p.end_lng!]]
              : [[p.start_lat, p.start_lng]]
            return (
              <>
                {hasRoute && (
                  <Polyline key={`line-${p.id}`}
                    positions={positions}
                    pathOptions={{ color: p.is_active ? '#4fb3e8' : '#1d4ed8', weight: p.is_active ? 3 : 2, opacity: p.is_active ? 0.9 : 0.5, dashArray: p.is_active ? undefined : '6 4' }}
                  />
                )}
                <Marker key={`start-${p.id}`} position={[p.start_lat, p.start_lng]} icon={p.is_active ? ICONS.patrol_active : ICONS.patrol_start}>
                  <Popup>
                    <div style={{ fontFamily:'system-ui', minWidth:'160px' }}>
                      <div style={{ fontWeight:700, fontSize:'13px', color: p.is_active ? '#4fb3e8' : '#3b82f6', marginBottom:'3px' }}>{p.is_active ? '● Active Patrol' : 'Patrol Log'}</div>
                      <div style={{ fontSize:'11px' }}>Type: <b style={{ textTransform:'capitalize' }}>{p.patrol_type}</b></div>
                      {p.sector && <div style={{ fontSize:'11px' }}>Sector: {p.sector}</div>}
                      {p.profiles && <div style={{ fontSize:'11px' }}>Ranger: {(p.profiles as { full_name: string }).full_name}</div>}
                      <div style={{ fontSize:'10px', color:'#94a3b8', marginTop:'4px' }}>
                        {new Date(p.start_time).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </>
            )
          })}

          {/* ── Wildlife Sightings (clustered) ── */}
          {show.wildlife && (
            <MarkerClusterGroup chunkedLoading>
              {wildlife.map(w => (
                <Marker key={w.id} position={[w.gps_lat, w.gps_lng]} icon={ICONS.wildlife}>
                  <Popup>
                    <div style={{ fontFamily:'system-ui', minWidth:'160px' }}>
                      <div style={{ fontWeight:700, fontSize:'13px', color:'#16a34a', marginBottom:'3px' }}>Wildlife Sighting</div>
                      <div style={{ fontWeight:600, fontSize:'12px', marginBottom:'3px' }}>{w.species_type ?? 'Unknown species'}</div>
                      {w.behavior && <div style={{ fontSize:'11px', color:'#64748b' }}>Behaviour: {w.behavior}</div>}
                      <div style={{ fontSize:'11px', marginTop:'3px' }}>Status: <span style={{ color: w.validation_status === 'approved' ? '#16a34a' : w.validation_status === 'rejected' ? '#dc2626' : '#d97706', fontWeight:600, textTransform:'capitalize' }}>{w.validation_status}</span></div>
                      <div style={{ fontSize:'10px', color:'#94a3b8', marginTop:'4px' }}>
                        {new Date(w.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          )}

          {/* ── Environmental Incidents (clustered) ── */}
          {show.incidents && (
            <MarkerClusterGroup chunkedLoading>
              {incidents.map(i => (
                <Marker key={i.id} position={[i.gps_lat, i.gps_lng]} icon={getIncidentIcon(i.severity ?? 1)}>
                  <Popup>
                    <div style={{ fontFamily:'system-ui', minWidth:'160px' }}>
                      <div style={{ fontWeight:700, fontSize:'13px', color: i.severity && i.severity >= 4 ? '#dc2626' : '#f59e0b', marginBottom:'3px' }}>Incident Report</div>
                      <div style={{ fontWeight:600, fontSize:'12px', marginBottom:'3px' }}>{i.incident_type ?? 'Unknown'}</div>
                      <div style={{ fontSize:'11px' }}>Severity: <b style={{ color: COND_COLOR[i.severity ?? 1] ?? '#f59e0b' }}>{i.severity ?? '?'}/5</b></div>
                      <div style={{ fontSize:'11px', marginTop:'2px' }}>Status: <span style={{ color: i.validation_status === 'approved' ? '#16a34a' : '#d97706', fontWeight:600, textTransform:'capitalize' }}>{i.validation_status}</span></div>
                      <div style={{ fontSize:'10px', color:'#94a3b8', marginTop:'4px' }}>
                        {new Date(i.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          )}
        </MapContainer>

        {/* ── Coordinate bar ── */}
        {coords && (
          <div style={{ position:'absolute', bottom:'10px', left:'10px', zIndex:1000, background:'rgba(7,21,36,0.88)', border:'1px solid var(--border)', borderRadius:'5px', padding:'4px 10px', fontFamily:'monospace', fontSize:'0.7rem', color:'var(--text-muted)', backdropFilter:'blur(4px)', display:'flex', gap:'12px' }}>
            <span>{coords[0].toFixed(5)}°N</span>
            <span>{Math.abs(coords[1]).toFixed(5)}°W</span>
          </div>
        )}

        {/* ── Location badge ── */}
        <div style={{ position:'absolute', top:'10px', right:'10px', zIndex:1000, background:'rgba(7,21,36,0.88)', border:'1px solid rgba(0,188,212,0.3)', borderRadius:'6px', padding:'5px 10px', fontSize:'0.68rem', color:'#00bcd4', fontWeight:600, backdropFilter:'blur(4px)', letterSpacing:'0.02em' }}>
          English Harbour · Antigua
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

