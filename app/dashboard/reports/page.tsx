'use client'
import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { audit } from '@/lib/audit/log-action'
import {
  generatePatrolReport, generateWildlifeReport,
  generateHeritageReport, generateWaterQualityReport
} from '@/lib/reports/pdf-generators'

// ── Types & helpers ─────────────────────────────────────────────────────────────────
function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

const PRESETS = [
  { label: 'Last 7 days',  days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This year',    days: 365 },
]

type ReportId = 'patrol' | 'wildlife' | 'heritage' | 'water_quality'

const REPORTS: { id: ReportId; label: string; color: string; desc: string; svgPath: string }[] = [
  { id: 'patrol',       label: 'Patrol Operations',     color: '#4fb3e8', desc: 'Patrol logs, violations, fuel usage, duty hours by ranger',  svgPath: 'M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z' },
  { id: 'wildlife',     label: 'Wildlife & CS Reports', color: '#22c55e', desc: 'Citizen science sightings, incidents, species breakdown',       svgPath: 'M2 12a10 10 0 1 0 20 0A10 10 0 0 0 2 12z' },
  { id: 'heritage',     label: 'Heritage Inspections',  color: '#f59e0b', desc: 'Site condition ratings, assessment history, maintenance queue', svgPath: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  { id: 'water_quality',label: 'Water Quality',         color: '#0891b2', desc: 'pH, DO, temperature, compliance status by station',           svgPath: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z' },
]

// ── Stat card ────────────────────────────────────────────────────────────────────────────
function StatCard({ val, label, color, sub }: { val: string | number; label: string; color: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: '1.9rem', fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: '5px' }}>{val}</div>
      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: sub ? '2px' : 0 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const now    = new Date()
  const ago30  = new Date(now); ago30.setDate(ago30.getDate() - 30)

  const [startDate,   setStartDate]   = useState(isoDate(ago30))
  const [endDate,     setEndDate]     = useState(isoDate(now))
  const [reportId,    setReportId]    = useState<ReportId>('patrol')
  const [generating,  setGenerating]  = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [stats,       setStats]       = useState<null | {
    patrols: number; violations: number; activePatrols: number; fuelTotal: number
    wildlife: number; incidents: number; highSev: number; csPending: number
    assessments: number; criticalSites: number; openMaint: number
    wqReadings: number; wqPass: number; wqFail: number
  }>(null)

  // ── Fetch aggregated stats ────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const startIso = new Date(startDate).toISOString()
    const endIso   = new Date(endDate + 'T23:59:59').toISOString()

    const [pResult, csResult, haResult, wqResult, hsResult, maintResult] = await Promise.all([
      sb.from('patrol_logs').select('violations, fuel_used_l, is_active').gte('start_time', startIso).lte('start_time', endIso),
      sb.from('citizen_science_reports').select('report_type, severity, validation_status').gte('created_at', startIso).lte('created_at', endIso),
      sb.from('heritage_assessments').select('overall_condition').gte('assessed_at', startIso).lte('assessed_at', endIso),
      sb.from('water_quality').select('compliance_status').gte('sampled_at', startIso).lte('sampled_at', endIso),
      sb.from('heritage_sites').select('current_condition').eq('is_active', true),
      sb.from('maintenance_items').select('status, priority').eq('status', 'open'),
    ])

    const patrols = pResult.data ?? []
    const cs      = csResult.data ?? []
    const ha      = haResult.data ?? []
    const wq      = wqResult.data ?? []
    const hs      = hsResult.data ?? []
    const maint   = maintResult.data ?? []

    setStats({
      patrols:      patrols.length,
      violations:   patrols.reduce((a, p) => a + (p.violations ?? 0), 0),
      activePatrols:patrols.filter(p => p.is_active).length,
      fuelTotal:    Math.round(patrols.reduce((a, p) => a + (p.fuel_used_l ?? 0), 0)),
      wildlife:     cs.filter(r => r.report_type === 'wildlife_sighting').length,
      incidents:    cs.filter(r => r.report_type === 'environmental_incident').length,
      highSev:      cs.filter(r => r.report_type === 'environmental_incident' && (r.severity ?? 0) >= 4).length,
      csPending:    cs.filter(r => r.validation_status === 'pending').length,
      assessments:  ha.length,
      criticalSites:hs.filter(s => (s.current_condition ?? 5) <= 2).length,
      openMaint:    maint.length,
      wqReadings:   wq.length,
      wqPass:       wq.filter(r => r.compliance_status === 'pass').length,
      wqFail:       wq.filter(r => r.compliance_status === 'fail').length,
    })
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => { fetchStats() }, [fetchStats])

  // ── Generate + download PDF ───────────────────────────────────────────────
  async function generateAndDownload() {
    setGenerating(true)
    const sb = createClient()
    const startIso = new Date(startDate).toISOString()
    const endIso   = new Date(endDate + 'T23:59:59').toISOString()
    const range    = { start: startDate, end: endDate }
    let doc

    try {
      if (reportId === 'patrol') {
        const { data } = await sb.from('patrol_logs')
          .select('*, profiles(full_name)')
          .gte('start_time', startIso).lte('start_time', endIso)
          .order('start_time', { ascending: false })
        doc = generatePatrolReport((data ?? []) as Record<string,unknown>[], range)
        doc.save(`NDNP-Patrol-Report-${startDate}-${endDate}.pdf`)
        await audit.reportDownloaded('Patrol Operations', { start: startDate, end: endDate })

      } else if (reportId === 'wildlife') {
        const { data } = await sb.from('citizen_science_reports')
          .select('*')
          .gte('created_at', startIso).lte('created_at', endIso)
          .order('created_at', { ascending: false })
        doc = generateWildlifeReport((data ?? []) as Record<string,unknown>[], range)
        doc.save(`NDNP-Wildlife-Report-${startDate}-${endDate}.pdf`)

      } else if (reportId === 'heritage') {
        const [assResult, sitesResult, maintResult] = await Promise.all([
          sb.from('heritage_assessments').select('*, heritage_sites(name, site_code)').gte('assessed_at', startIso).lte('assessed_at', endIso).order('assessed_at', { ascending: false }),
          sb.from('heritage_sites').select('*').eq('is_active', true).order('current_condition', { ascending: true }),
          sb.from('maintenance_items').select('*, heritage_sites(name, site_code)').eq('status', 'open').order('priority', { ascending: true }),
        ])
        doc = generateHeritageReport(
          (assResult.data  ?? []) as Record<string,unknown>[],
          (sitesResult.data ?? []) as Record<string,unknown>[],
          (maintResult.data ?? []) as Record<string,unknown>[],
          range
        )
        doc.save(`NDNP-Heritage-Report-${startDate}-${endDate}.pdf`)

      } else if (reportId === 'water_quality') {
        const { data } = await sb.from('water_quality')
          .select('*, monitoring_stations(station_code, name)')
          .gte('sampled_at', startIso).lte('sampled_at', endIso)
          .order('sampled_at', { ascending: false })
        doc = generateWaterQualityReport((data ?? []) as Record<string,unknown>[], range)
        doc.save(`NDNP-WaterQuality-Report-${startDate}-${endDate}.pdf`)
      }
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setGenerating(false)
    }
  }

  function applyPreset(days: number) {
    const end   = new Date()
    const start = new Date(); start.setDate(start.getDate() - days)
    setStartDate(isoDate(start)); setEndDate(isoDate(end))
  }

  const selectedReport = REPORTS.find(r => r.id === reportId)!
  const complianceRate = stats && stats.wqReadings > 0
    ? `${((stats.wqPass / stats.wqReadings) * 100).toFixed(0)}%`
    : '—'

  const S = { ...{ padding: '9px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '0.875rem', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' as const } }

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1100px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '4px' }}>Reports & Analytics</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>FR-DOC-02 · Generate downloadable PDF reports · Date-filtered aggregated statistics</p>
      </div>

      {/* Date filter row */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{ ...S, padding: '7px 10px', width: '150px' }} />
          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            style={{ ...S, padding: '7px 10px', width: '150px' }} />
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button key={p.days} onClick={() => applyPreset(p.days)}
              style={{ padding: '5px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '5px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', transition: 'all 150ms' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(13,148,136,0.5)', e.currentTarget.style.color = 'var(--teal)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)', e.currentTarget.style.color = 'var(--text-muted)')}
            >{p.label}</button>
          ))}
        </div>
      </div>

      {/* Aggregated stats */}
      <div style={{ marginBottom: '8px', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Statistics for selected period {loading && '— loading…'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginBottom: '24px', opacity: loading ? 0.5 : 1, transition: 'opacity 300ms' }}>
        <StatCard val={stats?.patrols       ?? '—'} label="Patrols"        color="#4fb3e8" sub="in period" />
        <StatCard val={stats?.violations    ?? '—'} label="Violations"     color="#ef4444" sub="cited" />
        <StatCard val={stats?.activePatrols ?? '—'} label="Active Now"     color="#22c55e" sub="in the field" />
        <StatCard val={stats ? `${stats.fuelTotal}L` : '—'} label="Fuel Used" color="#f59e0b" sub="boat patrols" />
        <StatCard val={stats?.wildlife      ?? '—'} label="Sightings"      color="#22c55e" sub="wildlife CS" />
        <StatCard val={stats?.incidents     ?? '—'} label="CS Incidents"   color="#ef4444" sub="env incidents" />
        <StatCard val={stats?.highSev       ?? '—'} label="High-Severity"  color="#dc2626" sub="sev 4–5" />
        <StatCard val={stats?.criticalSites ?? '—'} label="Critical Sites"  color="#f97316" sub="heritage 1–2/5" />
        <StatCard val={stats?.assessments   ?? '—'} label="Assessments"    color="#f59e0b" sub="heritage" />
        <StatCard val={stats?.openMaint     ?? '—'} label="Open Maint."    color="#f97316" sub="work items" />
        <StatCard val={stats?.wqReadings    ?? '—'} label="WQ Readings"    color="#0891b2" sub="water quality" />
        <StatCard val={complianceRate}               label="WQ Compliance"  color="#0891b2" sub="pass rate" />
      </div>

      {/* Report generator */}
      <div style={{ marginBottom: '8px', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Generate PDF Report</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        {REPORTS.map(r => (
          <button key={r.id} onClick={() => setReportId(r.id)}
            style={{ background: reportId === r.id ? `${r.color}14` : 'var(--surface)', border: `1px solid ${reportId === r.id ? `${r.color}50` : 'var(--border)'}`, borderRadius: '10px', padding: '14px 16px', cursor: 'pointer', textAlign: 'left', transition: 'all 150ms', borderLeft: reportId === r.id ? `3px solid ${r.color}` : `3px solid transparent` }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '6px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: `${r.color}18`, border: `1px solid ${r.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={r.color} strokeWidth="2"><path d={r.svgPath}/></svg>
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: reportId === r.id ? r.color : 'var(--text)' }}>{r.label}</div>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{r.desc}</div>
          </button>
        ))}
      </div>

      {/* Generate button + info */}
      <div className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: selectedReport.color, flexShrink: 0 }} />
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>{selectedReport.label}</div>
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{selectedReport.desc}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Period: <b style={{ color: 'var(--text)' }}>{new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</b>
            {' '}—{' '}
            <b style={{ color: 'var(--text)' }}>{new Date(endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</b>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          <button onClick={generateAndDownload} disabled={generating}
            style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '12px 24px', background: generating ? 'rgba(13,148,136,0.4)' : 'var(--teal)', color: '#fff', border: 'none', borderRadius: '8px', cursor: generating ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 700, transition: 'background 150ms' }}
            onMouseEnter={e => !generating && ((e.target as HTMLButtonElement).style.background = 'var(--teal-light)')}
            onMouseLeave={e => !generating && ((e.target as HTMLButtonElement).style.background = 'var(--teal)')}
          >
            {generating ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            )}
            {generating ? 'Building PDF…' : 'Download PDF'}
          </button>
          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textAlign: 'right' }}>Generates instantly in your browser · No server required</div>
        </div>
      </div>

      {/* PDF preview note */}
      <div style={{ marginTop: '14px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '8px', padding: '12px 16px', fontSize: '0.76rem', color: '#7fb3d8', lineHeight: 1.6 }}>
        <b style={{ color: '#60a5fa' }}>PDF contents:</b> Each report includes an NDNP MPA-MES branded header, period details, aggregated statistics summary table, and a full data table with all records from the selected period. Pages are auto-numbered with a footer showing the generation timestamp and confidentiality notice.
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}



