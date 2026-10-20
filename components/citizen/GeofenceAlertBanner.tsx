'use client'

import { useState, useEffect, useRef } from 'react'
import { evaluateGeofence, SIMULATION_POINTS, RESTRICTED_MARINE_ZONE, type ZoneDefinition } from '@/lib/visitor/geofence'
import { AlertTriangle, ShieldCheck, MapPin, Compass, X, ChevronRight, Info } from 'lucide-react'

interface GeofenceAlertBannerProps {
  onLocationUpdate?: (coords: [number, number], zone: ZoneDefinition | null) => void
  currentCoords?: [number, number] | null
}

export default function GeofenceAlertBanner({ onLocationUpdate, currentCoords }: GeofenceAlertBannerProps) {
  const [coords, setCoords] = useState<[number, number] | null>(currentCoords || null)
  const coordsRef = useRef<[number, number] | null>(coords)
  coordsRef.current = coords
  const [activeZone, setActiveZone] = useState<ZoneDefinition | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simIndex, setSimIndex] = useState(0)
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)
  const [trackingError, setTrackingError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  // Geolocation tracking
  useEffect(() => {
    if (isSimulating) return

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const newCoords: [number, number] = [pos.coords.latitude, pos.coords.longitude]
          setCoords(newCoords)
          setGpsAccuracy(pos.coords.accuracy)
          const zone = evaluateGeofence(newCoords)
          setActiveZone(zone)
          if (zone) setIsDismissed(false)
          onLocationUpdate?.(newCoords, zone)
          setTrackingError(null)
        },
        (err) => {
          console.warn('Geolocation error:', err.message)
          setTrackingError(err.message)
          // Default to Nelson's Dockyard Center coordinates if geolocation unavailable
          if (!coordsRef.current) {
            const fallback: [number, number] = [17.0076, -61.7644]
            setCoords(fallback)
            const zone = evaluateGeofence(fallback)
            setActiveZone(zone)
            onLocationUpdate?.(fallback, zone)
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      )
    }

    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [isSimulating, onLocationUpdate])

  // Simulation handler
  const setSimulationPoint = (idx: number) => {
    setIsSimulating(true)
    setSimIndex(idx)
    const pt = SIMULATION_POINTS[idx]
    setCoords(pt.coords)
    const zone = evaluateGeofence(pt.coords)
    setActiveZone(zone)
    setIsDismissed(false)
    onLocationUpdate?.(pt.coords, zone)
  }

  const resetToGps = () => {
    setIsSimulating(false)
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const pt: [number, number] = [pos.coords.latitude, pos.coords.longitude]
          setCoords(pt)
          const zone = evaluateGeofence(pt)
          setActiveZone(zone)
          onLocationUpdate?.(pt, zone)
        },
        () => {
          // If denied, set default center
          const fallback: [number, number] = [17.0076, -61.7644]
          setCoords(fallback)
          const zone = evaluateGeofence(fallback)
          setActiveZone(zone)
          onLocationUpdate?.(fallback, zone)
        }
      )
    }
  }

  return (
    <div style={{ position: 'relative', zIndex: 90 }}>
      {/* Simulation Toolbar for demo/testing */}
      <div
        style={{
          background: 'var(--surface2)',
          borderBottom: '1px solid var(--border)',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '11px',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Compass size={13} style={{ color: 'var(--teal)' }} />
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>Geofence Radar:</span>
          <span>
            {coords ? `${coords[0].toFixed(4)}°N, ${Math.abs(coords[1]).toFixed(4)}°W` : 'Acquiring GPS...'}
          </span>
          {isSimulating ? (
            <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
              SIMULATED
            </span>
          ) : (
            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
              LIVE GPS
            </span>
          )}
        </div>

        {/* Simulator location pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', marginRight: '2px' }}>Test Zone:</span>
          {SIMULATION_POINTS.map((p, idx) => (
            <button
              key={p.label}
              onClick={() => setSimulationPoint(idx)}
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: isSimulating && simIndex === idx ? 'var(--teal)' : 'var(--surface)',
                color: isSimulating && simIndex === idx ? '#fff' : 'var(--text-dim)',
                cursor: 'pointer',
                fontWeight: isSimulating && simIndex === idx ? 700 : 500,
                transition: 'all 120ms ease',
              }}
              title={`Simulate GPS at ${p.coords[0]}, ${p.coords[1]}`}
            >
              {p.label.split(' ')[1] || p.label.split(' ')[0]}
            </button>
          ))}
          {isSimulating && (
            <button
              onClick={resetToGps}
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(0,188,212,0.4)',
                background: 'rgba(0,188,212,0.1)',
                color: 'var(--teal)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Reset to GPS
            </button>
          )}
        </div>
      </div>

      {/* Amber/Red Alert Banner for Restricted or Regulated Zones */}
      {activeZone && !isDismissed && (
        <div
          style={{
            background:
              activeZone.status === 'RESTRICTED'
                ? 'linear-gradient(90deg, rgba(239,68,68,0.92), rgba(185,28,28,0.95))'
                : 'linear-gradient(90deg, rgba(59,130,246,0.92), rgba(29,78,216,0.95))',
            color: '#ffffff',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
            animation: 'fadeIn 200ms ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '-0.2px' }}>
                {activeZone.status === 'RESTRICTED'
                  ? 'RESTRICTED CORAL RESTORATION ZONE DETECTED'
                  : 'REGULATED MARINE ZONE'}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.95, lineHeight: 1.4 }}>
                {activeZone.alertMessage}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={() => setShowRulesModal(true)}
              style={{
                background: '#ffffff',
                color: activeZone.status === 'RESTRICTED' ? '#dc2626' : '#2563eb',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              Review Rules
              <ChevronRight size={13} />
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '6px',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#fff',
              }}
              title="Dismiss warning"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && activeZone && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                background: activeZone.status === 'RESTRICTED' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color={activeZone.status === 'RESTRICTED' ? '#ef4444' : '#3b82f6'} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                  {activeZone.name}
                </h3>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                Under the <strong>Nelson&apos;s Dockyard National Park (MPA) Regulations</strong>, this area is subjected to strict conservation measures:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {activeZone.rules.map((rule, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'start',
                      gap: '10px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '12px',
                      color: 'var(--text)',
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: activeZone.status === 'RESTRICTED' ? '#ef4444' : '#3b82f6', fontWeight: 700 }}>•</span>
                    <span>{rule}</span>
                  </div>
                ))}
              </div>

              {activeZone.speedLimitKnots && (
                <div
                  style={{
                    background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <Info size={16} color="#f59e0b" />
                  <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 600 }}>
                    Maximum Maritime Speed Limit: {activeZone.speedLimitKnots} knots
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setShowRulesModal(false)}
                  style={{
                    background: 'var(--teal)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  I Understand & Comply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
