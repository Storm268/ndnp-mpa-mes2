'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'

// Leaflet requires no SSR
const MapLocationPicker = dynamic(() => import('./MapLocationPicker'), { ssr: false })

interface Props {
  value: { lat: number | null; lng: number | null }
  onChange: (coords: { lat: number; lng: number }) => void
  label?: string
}

export default function MapLocationLoader({ value, onChange, label = 'Location' }: Props) {
  const [open, setOpen] = useState(false)

  const hasLocation = value.lat != null && value.lng != null

  return (
    <>
      {/* Trigger button */}
      <div>
        <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#7aa3be', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>
          {label}
        </label>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            width:'100%', padding:'11px 14px', display:'flex', alignItems:'center', gap:'10px',
            background: hasLocation ? 'rgba(0,188,212,0.08)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${hasLocation ? 'rgba(0,188,212,0.4)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius:'8px', cursor:'pointer', textAlign:'left', fontFamily:'inherit',
          }}
        >
          {/* GPS icon */}
          <div style={{ width:'32px', height:'32px', borderRadius:'8px', background: hasLocation ? 'rgba(0,188,212,0.15)' : 'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasLocation ? '#00bcd4' : '#5a7d94'} strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10H12V2z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            {hasLocation ? (
              <>
                <div style={{ fontSize:'13px', fontWeight:'700', color:'#00bcd4', marginBottom:'1px' }}>Location selected</div>
                <div style={{ fontSize:'11px', color:'#5a7d94', fontFamily:'monospace' }}>
                  {value.lat!.toFixed(5)}°N, {Math.abs(value.lng!).toFixed(5)}°W
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize:'13px', fontWeight:'600', color:'#7aa3be' }}>Tap to pick location on map</div>
                <div style={{ fontSize:'11px', color:'#5a7d94' }}>Uses your device GPS or manual tap</div>
              </>
            )}
          </div>
          {hasLocation && (
            <div style={{ fontSize:'11px', color:'#00bcd4', fontWeight:'600', flexShrink:0 }}>Change</div>
          )}
        </button>
      </div>

      {/* Full-screen map picker */}
      {open && (
        <MapLocationPicker
          value={value}
          onChange={coords => { onChange(coords); setOpen(false) }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

