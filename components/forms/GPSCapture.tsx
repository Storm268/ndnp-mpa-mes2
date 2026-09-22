'use client'
import dynamic from 'next/dynamic'

// Lazy-load map picker (Leaflet is client-only)
const MapLocationLoader = dynamic(() => import('./MapLocationLoader'), { ssr: false })

interface GPSCaptureProps {
  lat: string
  lng: string
  onCapture: (lat: number, lng: number) => void
  required?: boolean
}

export function GPSCapture({ lat, lng, onCapture, required }: GPSCaptureProps) {
  const hasLocation = lat !== '' && lng !== ''
  const numLat = hasLocation ? parseFloat(lat) : null
  const numLng = hasLocation ? parseFloat(lng) : null

  return (
    <div>
      {required && !hasLocation && (
        <div style={{ fontSize:'0.65rem', color:'#ef4444', marginBottom:'4px' }}>
          * Location required
        </div>
      )}
      <MapLocationLoader
        label="GPS Location"
        value={{ lat: numLat, lng: numLng }}
        onChange={coords => onCapture(coords.lat, coords.lng)}
      />
    </div>
  )
}

export function RatingSlider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label?: string }) {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#0d9488']
  const labels = ['Critical', 'Poor', 'Fair', 'Good', 'Excellent']
  return (
    <div>
      {label && <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text)', marginBottom: '6px' }}>{label}</div>}
      <div style={{ display: 'flex', gap: '6px' }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" onClick={() => onChange(n)}
            style={{ flex: 1, padding: '8px 4px', border: `2px solid ${n === value ? colors[n-1] : 'var(--border)'}`, borderRadius: '6px', background: n === value ? `${colors[n-1]}18` : 'var(--surface)', cursor: 'pointer', transition: 'all 150ms', textAlign: 'center' }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: n === value ? colors[n-1] : 'var(--text-muted)' }}>{n}</div>
            <div style={{ fontSize: '0.55rem', fontWeight: 600, color: n === value ? colors[n-1] : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '1px' }}>{labels[n-1]}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

