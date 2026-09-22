import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MapLoader from '@/components/map/MapLoader'

export default async function MapsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      {/* Page header */}
      <div style={{ padding:'16px 28px 12px', borderBottom:'1px solid var(--border)', background:'var(--surface)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:'1.2rem', fontWeight:800, color:'var(--text)', letterSpacing:'-0.02em', marginBottom:'2px' }}>Park Map</h1>
          <p style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>FR-GIS-01 · Patrol routes · Monitoring stations · Heritage sites · Citizen science clustering</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'0.65rem', fontWeight:700, color:'var(--teal)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
          <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--teal)', display:'inline-block', animation:'livePulse 2s ease-in-out infinite' }} />
          Real-time
        </div>
      </div>
      {/* Map fills remaining height */}
      <div style={{ flex:1, overflow:'hidden', display:'flex' }}>
        <MapLoader />
      </div>
    </div>
  )
}

