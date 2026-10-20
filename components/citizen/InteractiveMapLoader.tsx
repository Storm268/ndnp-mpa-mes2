'use client'

import dynamic from 'next/dynamic'

// Dynamic import with ssr:false MUST live in a Client Component for Leaflet
const InteractiveMarineTrailMap = dynamic(
  () => import('./InteractiveMarineTrailMap'),
  {
    ssr: false,
    loading: () => (
      <div style={{ flex: 1, width: '100%', height: '100%', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: '0.85rem', gap: '10px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"/></svg>
        Loading Interactive Trail Map…
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    ),
  }
)

interface InteractiveMapLoaderProps {
  showDrawer?: boolean
  initialDrawerOpen?: boolean
  mapHeight?: string
}

export default function InteractiveMapLoader({
  showDrawer = true,
  initialDrawerOpen = true,
  mapHeight = '100%',
}: InteractiveMapLoaderProps) {
  return (
    <InteractiveMarineTrailMap
      showDrawer={showDrawer}
      initialDrawerOpen={initialDrawerOpen}
      mapHeight={mapHeight}
    />
  )
}

