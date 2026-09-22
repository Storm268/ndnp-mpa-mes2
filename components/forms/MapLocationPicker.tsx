'use client'
import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, ZoomControl } from 'react-leaflet'
import { divIcon, type LatLng } from 'leaflet'

const PARK_CENTER: [number, number] = [17.0058, -61.7641]
const PARK_ZOOM = 14

// Pulsing GPS marker icon
const gpsIcon = divIcon({
  html: `<div style="width:36px;height:36px;position:relative">
    <div style="position:absolute;inset:0;border-radius:50%;background:rgba(0,188,212,0.2);animation:gpsPulse 1.5s ease-out infinite"></div>
    <div style="position:absolute;top:6px;left:6px;width:24px;height:24px;border-radius:50%;background:#00bcd4;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,188,212,0.6)"></div>
  </div>`,
  className: '', iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -20],
})

function ClickHandler({ onPick }: { onPick: (latlng: LatLng) => void }) {
  useMapEvents({ click: e => onPick(e.latlng) })
  return null
}

interface Props {
  value: { lat: number | null; lng: number | null }
  onChange: (coords: { lat: number; lng: number }) => void
  onClose: () => void
}

export default function MapLocationPicker({ value, onChange, onClose }: Props) {
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(
    value.lat != null && value.lng != null ? { lat: value.lat, lng: value.lng } : null
  )
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [center, setCenter] = useState<[number, number]>(PARK_CENTER)
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)

  // Request GPS on mount
  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus('error'); return }
    setGpsStatus('loading')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        setGpsCoords({ lat: latitude, lng: longitude })
        setCenter([latitude, longitude])
        setGpsStatus('ok')
        // Auto-set if nothing picked yet
        if (!picked) setPicked({ lat: latitude, lng: longitude })
      },
      () => { setGpsStatus('error') },
      { timeout: 8000, maximumAge: 30000, enableHighAccuracy: true }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMapClick = useCallback((latlng: LatLng) => {
    setPicked({ lat: latlng.lat, lng: latlng.lng })
  }, [])

  const handleConfirm = () => {
    if (picked) { onChange(picked); onClose() }
  }

  const handleUseGps = () => {
    if (gpsCoords) { setPicked(gpsCoords); setCenter([gpsCoords.lat, gpsCoords.lng]) }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', flexDirection:'column', background:'#020b14' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', background:'rgba(2,11,20,0.95)', borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#7aa3be', cursor:'pointer', padding:'4px', display:'flex' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'15px', fontWeight:'700', color:'#fff' }}>Pick Location</div>
          <div style={{ fontSize:'11px', color:'#5a7d94' }}>Tap the map to place a pin — drag to adjust</div>
        </div>
        {gpsStatus === 'loading' && (
          <div style={{ fontSize:'11px', color:'#00bcd4', display:'flex', alignItems:'center', gap:'5px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-18 0"/></svg>
            Locating…
          </div>
        )}
        {gpsStatus === 'ok' && (
          <button onClick={handleUseGps} style={{ padding:'6px 12px', border:'1px solid rgba(0,188,212,0.4)', borderRadius:'7px', background:'rgba(0,188,212,0.1)', color:'#00bcd4', fontSize:'12px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10H12V2zM12 2a10 10 0 0 1 10 10"/><circle cx="12" cy="12" r="3"/></svg>
            My GPS
          </button>
        )}
      </div>

      {/* Map */}
      <div style={{ flex:1, position:'relative' }}>
        <MapContainer
          key={center.join(',')}
          center={center}
          zoom={PARK_ZOOM}
          zoomControl={false}
          style={{ width:'100%', height:'100%' }}
        >
          <ZoomControl position="bottomright" />
          <ClickHandler onPick={handleMapClick} />

          {/* Satellite */}
          <TileLayer
            attribution='&copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <TileLayer
            attribution=''
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            opacity={0.7}
          />

          {/* GPS position indicator */}
          {gpsCoords && (
            <Marker position={[gpsCoords.lat, gpsCoords.lng]} icon={divIcon({
              html: `<div style="width:16px;height:16px;border-radius:50%;background:#00bcd4;border:3px solid white;box-shadow:0 0 8px rgba(0,188,212,0.8)"></div>`,
              className: '', iconSize: [16, 16], iconAnchor: [8, 8],
            })} />
          )}

          {/* Picked location marker */}
          {picked && (
            <Marker position={[picked.lat, picked.lng]} icon={gpsIcon}
              draggable
              eventHandlers={{ dragend: e => {
                const ll = (e.target as { getLatLng: () => LatLng }).getLatLng()
                setPicked({ lat: ll.lat, lng: ll.lng })
              }}}
            />
          )}
        </MapContainer>

        {/* Crosshair hint (fades after pick) */}
        {!picked && (
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:1000, pointerEvents:'none', textAlign:'center' }}>
            <div style={{ width:'40px', height:'40px', border:'2px solid rgba(0,188,212,0.6)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px' }}>
              <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#00bcd4' }} />
            </div>
            <div style={{ fontSize:'12px', color:'#e2f0f9', background:'rgba(2,11,20,0.8)', padding:'4px 10px', borderRadius:'20px', whiteSpace:'nowrap' }}>Tap to pin location</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding:'12px 16px', background:'rgba(2,11,20,0.95)', borderTop:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}>
        {picked ? (
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'11px', color:'#5a7d94', marginBottom:'2px' }}>Selected Location</div>
              <div style={{ fontFamily:'monospace', fontSize:'13px', color:'#00bcd4', fontWeight:'600' }}>
                {picked.lat.toFixed(6)}°N, {Math.abs(picked.lng).toFixed(6)}°W
              </div>
            </div>
            <button onClick={() => setPicked(null)} style={{ padding:'8px 14px', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', background:'transparent', color:'#7aa3be', fontSize:'13px', cursor:'pointer' }}>
              Clear
            </button>
            <button onClick={handleConfirm} style={{ padding:'8px 20px', background:'linear-gradient(135deg,#00bcd4,#0077a8)', border:'none', borderRadius:'8px', color:'#fff', fontSize:'14px', fontWeight:'700', cursor:'pointer' }}>
              Confirm
            </button>
          </div>
        ) : (
          <div style={{ textAlign:'center', fontSize:'13px', color:'#5a7d94' }}>
            {gpsStatus === 'error' ? 'GPS unavailable — tap the map to pick a location' : 'Tap anywhere on the map to set the location'}
          </div>
        )}
      </div>

      <style>{`
        @keyframes gpsPulse { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(2.5);opacity:0} }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}


