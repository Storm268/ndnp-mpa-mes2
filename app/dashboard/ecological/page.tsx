import { createClient } from '@/lib/supabase/server'

function CoralBar({ pct, label, sublabel }: { pct: number; label: string; sublabel?: string }) {
  const color = pct >= 60 ? '#22c55e' : pct >= 35 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <div>
          <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 500 }}>{label}</span>
          {sublabel && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '8px' }}>{sublabel}</span>}
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: '7px', background: 'var(--surface2)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: '4px' }} />
      </div>
    </div>
  )
}

function WQStatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { color: string; bg: string }> = {
    pass:    { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    fail:    { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  }
  const s = status ? map[status] ?? { color: 'var(--text-muted)', bg: 'var(--surface2)' } : { color: 'var(--text-muted)', bg: 'var(--surface2)' }
  const label = status ? status.toUpperCase() : 'NO DATA'
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: '3px', color: s.color, background: s.bg }}>{label}</span>
  )
}

export default async function EcologicalDashboard() {
  const supabase = await createClient()

  const [{ data: coral }, { data: wq }, { data: fish }] = await Promise.all([
    supabase.from('coral_surveys')
      .select('station_id, live_coral_pct, bleaching_count, bleaching_pct, depth_m, benthic_cover, surveyed_at, monitoring_stations(name, station_code)')
      .order('surveyed_at', { ascending: false }).limit(20),
    supabase.from('water_quality')
      .select('station_id, ph, do_mgl, temperature_c, salinity_ppt, turbidity_ntu, compliance_status, sampled_at, monitoring_stations(name, station_code)')
      .order('sampled_at', { ascending: false }).limit(12),
    supabase.from('fish_surveys')
      .select('station_id, species_entries, surveyed_at, monitoring_stations(name, station_code)')
      .order('surveyed_at', { ascending: false }).limit(8),
  ])

  // Latest coral per station
  const latestCoral = new Map<string, Record<string, unknown>>()
  ;(coral ?? []).forEach((s: Record<string, unknown>) => {
    if (!latestCoral.has(String(s.station_id))) latestCoral.set(String(s.station_id), s)
  })

  // Latest WQ per station
  const latestWQ = new Map<string, Record<string, unknown>>()
  ;(wq ?? []).forEach((r: Record<string, unknown>) => {
    if (!latestWQ.has(String(r.station_id))) latestWQ.set(String(r.station_id), r)
  })

  const coralArr = Array.from(latestCoral.values())
  const avgCoral = coralArr.length ? coralArr.reduce((a, s) => a + (typeof s.live_coral_pct === 'number' ? s.live_coral_pct : 0), 0) / coralArr.length : null
  const bleachingCount = coralArr.filter(s => typeof s.bleaching_pct === 'number' && (s.bleaching_pct as number) > 20).length
  const wqArr = Array.from(latestWQ.values())
  const failCount = wqArr.filter(r => r.compliance_status === 'fail').length
  const warnCount = wqArr.filter(r => r.compliance_status === 'warning').length

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '4px' }}>Ecological Status</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>FR-DASH-02 · Real-time coral health indicators & water quality compliance</p>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {[
          { val: avgCoral != null ? `${avgCoral.toFixed(1)}%` : '—', label: 'Avg Live Coral', color: avgCoral != null ? (avgCoral >= 60 ? '#22c55e' : avgCoral >= 35 ? '#f59e0b' : '#ef4444') : 'var(--text-muted)', sub: `${latestCoral.size} stations` },
          { val: bleachingCount, label: 'Bleaching Alerts', color: bleachingCount > 0 ? '#ef4444' : '#22c55e', sub: '>20% bleaching' },
          { val: failCount, label: 'WQ Exceedances', color: failCount > 0 ? '#ef4444' : '#22c55e', sub: 'Parameter failures' },
          { val: warnCount, label: 'WQ Warnings', color: warnCount > 0 ? '#f59e0b' : '#22c55e', sub: 'Borderline readings' },
          { val: (fish ?? []).length, label: 'Fish Surveys', color: 'var(--sky)', sub: 'Recent records' },
        ].map(m => (
          <div key={m.label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: m.color, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: '5px' }}>{m.val}</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{m.label}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Coral cover */}
      <h2 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>Live Coral Cover — Latest Survey per Station</h2>
      <div className="card" style={{ padding: '20px 24px', marginBottom: '24px' }}>
        {coralArr.length === 0 ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No coral surveys recorded yet. Field teams can submit FR-FORM-01.</p>
        ) : coralArr.map((s: Record<string, unknown>) => {
          const ms = s.monitoring_stations as Record<string, string> | null
          const pct = typeof s.live_coral_pct === 'number' ? s.live_coral_pct : 0
          const date = typeof s.surveyed_at === 'string' ? new Date(s.surveyed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
          const blPct = typeof s.bleaching_pct === 'number' ? s.bleaching_pct : 0
          return (
            <div key={String(s.station_id)}>
              <CoralBar
                pct={pct}
                label={`${ms?.station_code ?? ''} · ${ms?.name ?? ''}`}
                sublabel={`depth ${typeof s.depth_m === 'number' ? s.depth_m.toFixed(1) : '?'}m · ${date}`}
              />
              {blPct > 0 && (
                <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '-8px', marginBottom: '10px', paddingLeft: '2px' }}>
                  ⚠ Bleaching: {blPct.toFixed(1)}% · {typeof s.bleaching_count === 'number' ? s.bleaching_count : 0} colonies
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Water Quality compliance table */}
      <h2 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        Water Quality Compliance
        <span style={{ fontSize: '0.6rem', color: 'var(--teal)', fontWeight: 700, letterSpacing: '0.06em' }}>• Traffic-Light Status</span>
      </h2>
      <div className="card" style={{ overflow: 'hidden', marginBottom: '24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Station', 'pH', 'DO (mg/L)', 'Temp (°C)', 'Salinity', 'Status', 'Sampled'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {wqArr.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '16px 14px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No water quality data yet. Submit FR-FORM-05.</td></tr>
            ) : wqArr.map((r: Record<string, unknown>, i: number) => {
              const ms = r.monitoring_stations as Record<string, string> | null
              const fmt = (v: unknown, dec = 1) => typeof v === 'number' ? v.toFixed(dec) : '—'
              const date = typeof r.sampled_at === 'string' ? new Date(r.sampled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--sky)', letterSpacing: '0.03em' }}>{ms?.station_code}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text)' }}>{ms?.name}</div>
                  </td>
                  <td style={{ padding: '10px 14px', color: typeof r.ph === 'number' && (r.ph < 7.8 || r.ph > 8.4) ? '#ef4444' : 'var(--text)' }}>{fmt(r.ph)}</td>
                  <td style={{ padding: '10px 14px', color: typeof r.do_mgl === 'number' && (r.do_mgl as number) < 5 ? '#ef4444' : 'var(--text)' }}>{fmt(r.do_mgl)}</td>
                  <td style={{ padding: '10px 14px', color: typeof r.temperature_c === 'number' && (r.temperature_c as number) > 30 ? '#f59e0b' : 'var(--text)' }}>{fmt(r.temperature_c)}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{fmt(r.salinity_ppt)} ppt</td>
                  <td style={{ padding: '10px 14px' }}><WQStatusBadge status={typeof r.compliance_status === 'string' ? r.compliance_status : null} /></td>
                  <td style={{ padding: '10px 14px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{date}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

