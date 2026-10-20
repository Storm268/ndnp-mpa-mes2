import { createClient } from '@/lib/supabase/server'

function PatrolTypeBadge({ type }: { type: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    boat:    { color: '#4fb3e8', bg: 'rgba(79,179,232,0.12)' },
    foot:    { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    drone:   { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
    vehicle: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  }
  const s = map[type] ?? { color: 'var(--text-muted)', bg: 'var(--surface2)' }
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '3px', color: s.color, background: s.bg }}>{type}</span>
  )
}

function Duration({ start, end }: { start: string; end?: string | null }) {
  const startMs = new Date(start).getTime()
  const endMs = end ? new Date(end).getTime() : Date.now()
  const mins = Math.floor((endMs - startMs) / 60000)
  if (mins < 60) return <span>{mins}m</span>
  return <span>{Math.floor(mins / 60)}h {mins % 60}m</span>
}

export default async function PatrolDashboard() {
  const supabase = await createClient()

  const [
    { data: activePatrols },
    { data: recentPatrols },
    { data: csIncidents },
    { count: openViolations },
  ] = await Promise.all([
    supabase.from('patrol_logs')
      .select('id, ranger_id, patrol_type, sector, start_lat, start_lng, start_time, violations, warnings, vessel_id, profiles(full_name)')
      .eq('is_active', true)
      .order('start_time', { ascending: false }),
    supabase.from('patrol_logs')
      .select('id, ranger_id, patrol_type, sector, start_time, end_time, violations, warnings, fuel_used_l, profiles(full_name)')
      .eq('is_active', false)
      .order('start_time', { ascending: false })
      .limit(10),
    supabase.from('citizen_science_reports')
      .select('id, report_type, severity, incident_type, description, gps_lat, gps_lng, validation_status, created_at')
      .eq('report_type', 'environmental_incident')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('patrol_logs').select('*', { count: 'exact', head: true }).gt('violations', 0),
  ])

  const totalViolationsToday = (recentPatrols ?? []).reduce((a: number, p: Record<string, unknown>) => a + (typeof p.violations === 'number' ? p.violations : 0), 0)
  const totalWarningsToday  = (recentPatrols ?? []).reduce((a: number, p: Record<string, unknown>) => a + (typeof p.warnings  === 'number' ? p.warnings  : 0), 0)
  const highSeverityCount   = (csIncidents  ?? []).filter((r: Record<string, unknown>) => typeof r.severity === 'number' && (r.severity as number) >= 4).length

  const severityColor = (s: number) => s >= 4 ? '#ef4444' : s === 3 ? '#f59e0b' : '#22c55e'

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '4px' }}>Patrol Operations & Incidents</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>FR-DASH-03 · Active patrol map, vessel observations, open violation cases</p>
      </div>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {[
          { val: (activePatrols ?? []).length, label: 'Active Patrols', color: '#4fb3e8', sub: 'Field units now' },
          { val: totalViolationsToday, label: 'Violations (Recent)', color: '#ef4444', sub: 'Completed patrols' },
          { val: totalWarningsToday, label: 'Warnings Issued', color: '#f59e0b', sub: 'Completed patrols' },
          { val: highSeverityCount, label: 'High-Severity CS', color: highSeverityCount > 0 ? '#ef4444' : '#22c55e', sub: 'Severity 4-5 incidents' },
          { val: (csIncidents ?? []).length, label: 'CS Incidents', color: '#8b5cf6', sub: 'Pending review' },
        ].map(m => (
          <div key={m.label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: m.color, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: '5px' }}>{m.val}</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{m.label}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Active patrols */}
      <h2 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        Active Patrols
        {(activePatrols ?? []).length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem', fontWeight: 700, color: 'var(--teal)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--teal)', display: 'inline-block', animation: 'livePulse 2s ease-in-out infinite' }} />
            Live
          </span>
        )}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px', marginBottom: '24px' }}>
        {(activePatrols ?? []).length === 0 ? (
          <div className="card" style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No active patrols right now. Rangers submit FR-FORM-04 to start a patrol.</div>
        ) : (activePatrols ?? []).map((p: Record<string, unknown>) => {
          const profile = p.profiles as Record<string, string> | null
          return (
            <div key={String(p.id)} className="card" style={{ padding: '14px 16px', borderLeft: '3px solid #4fb3e8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>{profile?.full_name ?? 'Ranger'}</div>
                  {typeof p.sector === 'string' && p.sector && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sector: {p.sector}</div>}
                </div>
                <PatrolTypeBadge type={String(p.patrol_type)} />
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                <span>Duration: <b style={{ color: 'var(--text)' }}><Duration start={String(p.start_time)} /></b></span>
                {typeof p.violations === 'number' && p.violations > 0 && <span>Violations: <b style={{ color: '#ef4444' }}>{p.violations}</b></span>}
              </div>
              {typeof p.vessel_id === 'string' && p.vessel_id && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>Vessel: {p.vessel_id}</div>}
            </div>
          )
        })}
      </div>

      {/* Recent completed patrols */}
      <h2 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>Recent Completed Patrols</h2>
      <div className="card" style={{ overflow: 'hidden', marginBottom: '24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Ranger', 'Type', 'Sector', 'Duration', 'Violations', 'Warnings', 'Fuel (L)'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(recentPatrols ?? []).length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '16px 14px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No completed patrols yet.</td></tr>
            ) : (recentPatrols ?? []).map((p: Record<string, unknown>) => {
              const profile = p.profiles as Record<string, string> | null
              return (
                <tr key={String(p.id)} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 500 }}>{profile?.full_name ?? 'Ranger'}</td>
                  <td style={{ padding: '10px 14px' }}><PatrolTypeBadge type={String(p.patrol_type)} /></td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{typeof p.sector === 'string' ? p.sector : '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{typeof p.start_time === 'string' && typeof p.end_time === 'string' ? <Duration start={p.start_time as string} end={p.end_time as string} /> : '—'}</td>
                  <td style={{ padding: '10px 14px', color: typeof p.violations === 'number' && p.violations > 0 ? '#ef4444' : 'var(--text)', fontWeight: typeof p.violations === 'number' && p.violations > 0 ? 700 : 400 }}>{typeof p.violations === 'number' ? p.violations : 0}</td>
                  <td style={{ padding: '10px 14px', color: typeof p.warnings === 'number' && p.warnings > 0 ? '#f59e0b' : 'var(--text)' }}>{typeof p.warnings === 'number' ? p.warnings : 0}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{typeof p.fuel_used_l === 'number' ? p.fuel_used_l.toFixed(1) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Citizen Science Incidents */}
      <h2 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>Environmental Incidents (Citizen Science)</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {(csIncidents ?? []).length === 0 ? (
          <div className="card" style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No citizen science incidents reported yet.</div>
        ) : (csIncidents ?? []).map((r: Record<string, unknown>) => {
          const sev = typeof r.severity === 'number' ? r.severity : 0
          const col = severityColor(sev)
          const date = typeof r.created_at === 'string' ? new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
          return (
            <div key={String(r.id)} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '14px', borderLeft: `3px solid ${col}` }}>
              <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '36px' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: col, lineHeight: 1 }}>{sev}</div>
                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Severity</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', marginBottom: '3px', textTransform: 'capitalize' }}>{typeof r.incident_type === 'string' ? r.incident_type.replace(/_/g, ' ') : 'Unknown type'}</div>
                {typeof r.description === 'string' && r.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>}
                <div style={{ display: 'flex', gap: '12px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  <span>GPS: {typeof r.gps_lat === 'number' ? (r.gps_lat as number).toFixed(4) : '?'}, {typeof r.gps_lng === 'number' ? (r.gps_lng as number).toFixed(4) : '?'}</span>
                  <span>{date}</span>
                </div>
              </div>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: '3px', background: r.validation_status === 'pending' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.1)', color: r.validation_status === 'pending' ? '#f59e0b' : '#22c55e', flexShrink: 0 }}>{String(r.validation_status)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}



