'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  onDone: () => void
}

export default function ShapefileUploader({ onDone }: Props) {
  const [uploading,   setUploading]   = useState(false)
  const [status,      setStatus]      = useState('')
  const [error,       setError]       = useState('')
  const [layerName,   setLayerName]   = useState('')
  const [layerColor,  setLayerColor]  = useState('#00bcd4')
  const [layerOpacity, setLayerOpacity] = useState(0.5)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please select a .zip file containing .shp + .dbf + .shx (+ .prj for CRS auto-detection).')
      return
    }
    if (!layerName.trim()) {
      setError('Please enter a layer name first.')
      return
    }

    setUploading(true); setError(''); setStatus('Loading projection library…')
    try {
      const proj4 = (await import('proj4')).default
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).proj4 = proj4
      }

      setStatus('Parsing shapefile…')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shpjs = (await import('shpjs')).default as any
      const buf   = await file.arrayBuffer()
      const raw   = await shpjs(buf)
      const collection = Array.isArray(raw) ? raw[0] : raw
      const featureCount: number = collection?.features?.length ?? 0

      if (!collection || !collection.type) throw new Error('Could not parse GeoJSON from shapefile.')

      // Validate WGS84
      function getFirstCoord(c: unknown): [number, number] | null {
        if (!Array.isArray(c)) return null
        if (typeof c[0] === 'number') return [c[0] as number, c[1] as number]
        for (const child of c) { const r = getFirstCoord(child); if (r) return r }
        return null
      }
      const fc = getFirstCoord(collection.features?.[0]?.geometry?.coordinates)
      if (fc && (Math.abs(fc[0]) > 180 || Math.abs(fc[1]) > 90)) {
        throw new Error(`Coordinates appear projected (${fc[0].toFixed(0)}, ${fc[1].toFixed(0)}). Include a .prj file in your ZIP for auto-reprojection.`)
      }

      setStatus(`Saving “${layerName}” (${featureCount} features)…`)
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()

      const { error: dbErr } = await sb.from('park_layers').insert({
        name:          layerName.trim(),
        geojson:       collection,
        color:         layerColor,
        opacity:       layerOpacity,
        is_visible:    true,
        created_by:    user?.id,
        file_name:     file.name,
        feature_count: featureCount,
      })
      if (dbErr) throw new Error(dbErr.message)

      setStatus(`✓ Layer “${layerName}” added (${featureCount} features)`)
      setLayerName('')
      setTimeout(() => { setStatus(''); onDone() }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
      setStatus('')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const inputStyle: React.CSSProperties = {
    width:'100%', padding:'9px 12px',
    background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
    borderRadius:'7px', color:'#e2f0f9', fontSize:'13px', outline:'none', fontFamily:'inherit',
  }

  return (
    <div>
      {error && (
        <div style={{ marginBottom:'12px', padding:'10px 14px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'8px', color:'#f87171', fontSize:'13px' }}>
          {error}
        </div>
      )}
      {status && (
        <div style={{ marginBottom:'12px', padding:'10px 14px', background:'rgba(0,188,212,0.08)', border:'1px solid rgba(0,188,212,0.2)', borderRadius:'8px', color:'#00bcd4', fontSize:'13px' }}>
          {status}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:'10px', alignItems:'end', marginBottom:'12px' }}>
        <div>
          <label style={{ display:'block', fontSize:'11px', fontWeight:'600', color:'#7aa3be', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'5px' }}>Layer Name *</label>
          <input style={inputStyle} placeholder="e.g. Marine Reserve Boundary" value={layerName} onChange={e => setLayerName(e.target.value)} />
        </div>
        <div>
          <label style={{ display:'block', fontSize:'11px', fontWeight:'600', color:'#7aa3be', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'5px' }}>Color</label>
          <input type="color" value={layerColor} onChange={e => setLayerColor(e.target.value)}
            style={{ width:'44px', height:'36px', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', cursor:'pointer', background:'none', padding:'2px' }} />
        </div>
        <div>
          <label style={{ display:'block', fontSize:'11px', fontWeight:'600', color:'#7aa3be', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'5px' }}>Opacity</label>
          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <input type="range" min="0.1" max="1" step="0.05" value={layerOpacity}
              onChange={e => setLayerOpacity(parseFloat(e.target.value))}
              style={{ width:'80px', accentColor: layerColor, cursor:'pointer' }} />
            <span style={{ fontSize:'12px', color:'#7aa3be', minWidth:'32px' }}>{Math.round(layerOpacity * 100)}%</span>
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".zip" style={{ display:'none' }} onChange={handleFile} />
      <button
        type="button"
        onClick={() => {
          if (!layerName.trim()) { setError('Enter a layer name first.'); return }
          setError(''); fileRef.current?.click()
        }}
        disabled={uploading}
        style={{ padding:'10px 20px', background: uploading ? 'rgba(0,188,212,0.3)' : 'linear-gradient(135deg,#00bcd4,#0077a8)', border:'none', borderRadius:'8px', color:'#fff', fontSize:'13px', fontWeight:'700', cursor: uploading ? 'not-allowed' : 'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'7px' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
        {uploading ? 'Processing…' : 'Select Shapefile ZIP'}
      </button>
      <p style={{ marginTop:'8px', fontSize:'11px', color:'#3d6b84', lineHeight:'1.6' }}>
        ZIP must contain .shp + .dbf + .shx files. Include .prj for automatic CRS reprojection. Max 50MB.
      </p>
    </div>
  )
}

