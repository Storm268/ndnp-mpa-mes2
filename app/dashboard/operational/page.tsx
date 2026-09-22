import { createClient } from '@/lib/supabase/server'

function StatCard({ value, label, color = 'var(--teal)', sub }: { value: string | number; label: string; color?: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ fontSize: '2.4rem', fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: '6px' }}>{value}</div>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: sub ? '3px' : 0 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

function SectionHeader({ title, live }: { title: string; live?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', marginTop: '28px' }}>
      <h2 style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{title}</h2>
      {live && (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--teal)' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--teal)', display: 'inline-block', animation: 'livePulse 2s ease-in-out infinite' }} />
          Live
        </span>
      )}
    </div>
  )
}

const WQ_STATUS: Record<string, { label: string; color: string }> = {
  pass:    { label: 'Pass',    color: 'var(--green)' },
  warning: { label: 'Warning', color: 'var(--amber)' },
  fail:    { label: 'Fail',    color: 'var(--red)' },
}

export default async function OperationalDashboard() {
  const supabase = await createClient()

  // Fetch all dashboard data in parallel
  const [
    { count: activePatrols },
    { data: wqRecent },
    { count: openMaintenance },
    { count: visitorCount },
    { count: pendingCS },
    { data: stations },
  ] = await Promise.all([
    supabase.from('patrol_logs').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('water_quality').select('station_id, compliance_status, temperature_c, ph, do_mgl, sampled_at, monitoring_stations(name, station_code)').order('sampled_at', { ascending: false }).limit(6),
    supabase.from('maintenance_items').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('visitor_surveys').select('*', { count: 'exact', head: true }).gte('surveyed_at', new Date(Date.now() - 86400000).toISOString()),
    supabase.from('citizen_science_reports').select('*', { count: 'exact', head: true }).eq('validation_status', 'pending'),
    supabase.from('monitoring_stations').select('id, station_code, name, station_type, is_active').eq('is_active', true).order('station_code'),
  ])

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '4px' }}>Operational Overview</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>FR-DASH-01 · Real-time park operations summary</p>
      </div>

      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
        <StatCard value={activePatrols ?? 0} label="Active Patrols" color="var(--sky)" sub="Field units deployed" />
        <StatCard value={openMaintenance ?? 0} label="Open Maintenance" color="var(--amber)" sub="Items requiring action" />
        <StatCard value={visitorCount ?? 0} label="Visitors Today" color="var(--purple)" sub="Survey responses (24h)" />
        <StatCard value={pendingCS ?? 0} label="Pending Validation" color="var(--teal)" sub="Citizen science reports" />
        <StatCard value={stations?.length ?? 0} label="Active Stations" color="var(--green)" sub="Monitoring network" />
      </div>

      {/* Water Quality Status */}
      <SectionHeader title="Water Quality Stations" live />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
        {(wqRecent ?? []).length === 0 ? (
          <div className="card" style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No water quality data recorded yet. Submit FR-FORM-05 from the field.</div>
        ) : wqRecent?.map((r: Record<string, unknown>, i: number) => {
          const ms = r.monitoring_stations as Record<string, string> | null
          const status = typeof r.compliance_status === 'string' ? WQ_STATUS[r.compliance_status] ?? { label: r.compliance_status, color: 'var(--text-muted)' } : { label: 'Unset', color: 'var(--text-muted)' }
          const sampledAt = typeof r.sampled_at === 'string' ? new Date(r.sampled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
          return (
            <div key={i} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--sky)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{ms?.station_code}</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>{ms?.name}</div>
                </div>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: status.color, marginTop: '4px', flexShrink: 0 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '8px' }}>
                {[['pH', typeof r.ph === 'number' ? r.ph.toFixed(1) : '—'], ['DO mg/L', typeof r.do_mgl === 'number' ? r.do_mgl.toFixed(1) : '—'], ['Temp °C', typeof r.temperature_c === 'number' ? r.temperature_c.toFixed(1) : '—']].map(([lbl, val]) => (
                  <div key={lbl} style={{ background: 'var(--surface2)', borderRadius: '5px', padding: '5px 7px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '1px' }}>{lbl}</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: status.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{status.label}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{sampledAt}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Monitoring Stations */}
      <SectionHeader title="Monitoring Network" />
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Station', 'Name', 'Type', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(stations ?? []).map((s: Record<string, unknown>) => (
              <tr key={String(s.id)} style={{ borderBottom: '1px solid rgba(26,58,82,0.5)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--sky)', fontSize: '0.75rem' }}>{String(s.station_code)}</td>
                <td style={{ padding: '10px 16px', color: 'var(--text)' }}>{String(s.name)}</td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--teal)', background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.2)', borderRadius: '3px', padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {String(s.station_type).replace('_', ' ')}
                  </span>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block', marginRight: '6px' }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--green)', fontWeight: 600 }}>Active</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

