import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { UserRole } from '@/lib/supabase/client'
import {
  DataCollectionRecordsList,
  type DataCollectionRecordItem,
} from '@/components/forms/DataCollectionRecordsList'

export const dynamic = 'force-dynamic'

const FORMS = [
  { id: 'FR-FORM-01', href: '/dashboard/forms/coral',       title: 'Coral Monitoring',           desc: '24 variables · benthic cover · bleaching count · GPS', icon: 'M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12', color: '#0d9488', roles: ['system_admin','park_manager','scientist','ranger'] as UserRole[] },
  { id: 'FR-FORM-02', href: '/dashboard/forms/fish',        title: 'Fish Survey',                desc: '16 variables · species dropdown · multi-row entry · GPS', icon: 'M6.5 12c0 1.1.4 2.1 1.1 2.8L3 19l4.2-4.2c.7.7 1.7 1.2 2.8 1.2 2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4z', color: '#4fb3e8', roles: ['system_admin','park_manager','scientist','ranger'] as UserRole[] },
  { id: 'FR-FORM-03', href: '/dashboard/forms/heritage',    title: 'Heritage Condition',         desc: '27 variables · condition ratings · element issues · GPS', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', color: '#f59e0b', roles: ['system_admin','park_manager','scientist','ranger'] as UserRole[] },
  { id: 'FR-FORM-04', href: '/dashboard/forms/patrol',      title: 'Patrol Log',                 desc: '20 variables · GPS start/end · violations · fuel entry', icon: 'M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z', color: '#4fb3e8', roles: ['system_admin','park_manager','ranger'] as UserRole[] },
  { id: 'FR-FORM-05', href: '/dashboard/forms/water-quality', title: 'Water Quality',            desc: '23 variables · pH · DO · temperature · chain of custody', icon: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z', color: '#0891b2', roles: ['system_admin','park_manager','scientist','ranger'] as UserRole[] },
  { id: 'FR-FORM-06', href: '/dashboard/forms/visitor-survey', title: 'Visitor Survey',          desc: '18 variables · activities · XCD expenditure · ratings', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', color: '#8b5cf6', roles: ['system_admin','park_manager','ranger'] as UserRole[] },
  { id: 'FR-FORM-07', href: '/dashboard/forms/wildlife',    title: 'Wildlife Sighting',          desc: 'Citizen science · species · behaviour · GPS · photo', icon: 'M2 12a10 10 0 1 0 20 0A10 10 0 0 0 2 12zm10-4a4 4 0 1 1 0 8 4 4 0 0 1 0-8z', color: '#22c55e', roles: ['system_admin','park_manager','scientist','ranger','visitor'] as UserRole[] },
  { id: 'FR-FORM-08', href: '/dashboard/forms/incident',    title: 'Environmental Incident',     desc: 'Citizen science · severity 1–5 · auto-alert for 4–5 · GPS', icon: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0-3.42 0zM12 9v4m0 4h.01', color: '#ef4444', roles: ['system_admin','park_manager','scientist','ranger','visitor'] as UserRole[] },
]

export default async function FormsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile?.role as UserRole) ?? 'visitor'

  const visible = FORMS.filter(f => f.roles.includes(role))

  const [coralRes, fishRes, wqRes, heritageRes, patrolRes, visitorRes, csRes] = await Promise.all([
    supabase
      .from('coral_surveys')
      .select('id, live_coral_pct, bleaching_pct, depth_m, surveyed_at, monitoring_stations(name, station_code)')
      .order('surveyed_at', { ascending: false })
      .limit(10),
    supabase
      .from('fish_surveys')
      .select('id, species_entries, depth_m, surveyed_at, monitoring_stations(name, station_code)')
      .order('surveyed_at', { ascending: false })
      .limit(10),
    supabase
      .from('water_quality')
      .select('id, ph, do_mgl, temperature_c, compliance_status, sampled_at, monitoring_stations(name, station_code)')
      .order('sampled_at', { ascending: false })
      .limit(10),
    supabase
      .from('heritage_assessments')
      .select('id, overall_condition, assessor_name, assessed_at, heritage_sites(name, site_code)')
      .order('assessed_at', { ascending: false })
      .limit(10),
    supabase
      .from('patrol_logs')
      .select('id, patrol_type, sector, violations, warnings, is_active, start_time')
      .order('start_time', { ascending: false })
      .limit(10),
    supabase
      .from('visitor_surveys')
      .select('id, country_of_origin, activities, expenditure_xcd, satisfaction_rating, surveyed_at')
      .order('surveyed_at', { ascending: false })
      .limit(10),
    supabase
      .from('citizen_science_reports')
      .select('id, report_type, species_type, species_count, incident_type, severity, validation_status, created_at')
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  const records: DataCollectionRecordItem[] = []

  ;(coralRes.data ?? []).forEach((r: Record<string, unknown>) => {
    const ms = r.monitoring_stations as Record<string, string> | null
    const pct = typeof r.live_coral_pct === 'number' ? r.live_coral_pct : 0
    records.push({
      id: String(r.id),
      type: 'coral',
      typeLabel: 'Live Coral',
      formCode: 'FR-FORM-01',
      color: '#0d9488',
      title: ms ? `${ms.station_code} · ${ms.name}` : 'Coral Monitoring Station',
      summary: `Live coral ${pct.toFixed(1)}%${typeof r.depth_m === 'number' ? ` · ${r.depth_m}m depth` : ''}${typeof r.bleaching_pct === 'number' && r.bleaching_pct > 0 ? ` · ${r.bleaching_pct}% bleaching` : ''}`,
      statusBadge: pct >= 60 ? 'Healthy' : pct >= 35 ? 'Moderate' : 'Degraded',
      statusColor: pct >= 60 ? '#22c55e' : pct >= 35 ? '#f59e0b' : '#ef4444',
      timestamp: String(r.surveyed_at ?? ''),
    })
  })

  ;(fishRes.data ?? []).forEach((r: Record<string, unknown>) => {
    const ms = r.monitoring_stations as Record<string, string> | null
    const entries = Array.isArray(r.species_entries)
      ? (r.species_entries as Array<{ species?: string; count?: number }>)
      : []
    const totalCount = entries.reduce((sum, en) => sum + (Number(en.count) || 0), 0)
    const topSpecies = entries.slice(0, 2).map((en) => en.species).filter(Boolean).join(', ')
    records.push({
      id: String(r.id),
      type: 'fish',
      typeLabel: 'Fish Survey',
      formCode: 'FR-FORM-02',
      color: '#4fb3e8',
      title: ms ? `${ms.station_code} · ${ms.name}` : 'Fish Survey Station',
      summary: `${totalCount} individuals across ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}${topSpecies ? ` (${topSpecies}${entries.length > 2 ? ', …' : ''})` : ''}`,
      statusBadge: `${totalCount} fish`,
      statusColor: '#4fb3e8',
      timestamp: String(r.surveyed_at ?? ''),
    })
  })

  ;(wqRes.data ?? []).forEach((r: Record<string, unknown>) => {
    const ms = r.monitoring_stations as Record<string, string> | null
    const status = typeof r.compliance_status === 'string' ? r.compliance_status : 'recorded'
    records.push({
      id: String(r.id),
      type: 'water_quality',
      typeLabel: 'Water Quality',
      formCode: 'FR-FORM-05',
      color: '#0891b2',
      title: ms ? `${ms.station_code} · ${ms.name}` : 'Water Quality Station',
      summary: [
        typeof r.ph === 'number' ? `pH ${r.ph.toFixed(1)}` : null,
        typeof r.do_mgl === 'number' ? `DO ${r.do_mgl.toFixed(1)} mg/L` : null,
        typeof r.temperature_c === 'number' ? `${r.temperature_c.toFixed(1)}°C` : null,
      ].filter(Boolean).join(' · ') || 'Water quality sample',
      statusBadge: status,
      statusColor: status === 'pass' ? '#22c55e' : status === 'warning' ? '#f59e0b' : status === 'fail' ? '#ef4444' : '#0891b2',
      timestamp: String(r.sampled_at ?? ''),
    })
  })

  ;(heritageRes.data ?? []).forEach((r: Record<string, unknown>) => {
    const hs = r.heritage_sites as Record<string, string> | null
    const cond = typeof r.overall_condition === 'number' ? r.overall_condition : 0
    records.push({
      id: String(r.id),
      type: 'heritage',
      typeLabel: 'Heritage',
      formCode: 'FR-FORM-03',
      color: '#f59e0b',
      title: hs ? `${hs.site_code} · ${hs.name}` : 'Heritage Site',
      summary: `Condition ${cond}/5 · Assessed by ${typeof r.assessor_name === 'string' ? r.assessor_name : 'Officer'}`,
      statusBadge: cond <= 2 ? 'Critical/Poor' : cond === 3 ? 'Fair' : 'Good',
      statusColor: cond <= 2 ? '#ef4444' : cond === 3 ? '#f59e0b' : '#22c55e',
      timestamp: String(r.assessed_at ?? ''),
    })
  })

  ;(patrolRes.data ?? []).forEach((r: Record<string, unknown>) => {
    const violations = Number(r.violations) || 0
    records.push({
      id: String(r.id),
      type: 'patrol',
      typeLabel: 'Patrol Log',
      formCode: 'FR-FORM-04',
      color: '#3b82f6',
      title: `${String(r.patrol_type ?? 'Patrol').toUpperCase()}${r.sector ? ` · ${String(r.sector)}` : ''}`,
      summary: `${violations} violation(s) · ${Number(r.warnings) || 0} warning(s)`,
      statusBadge: r.is_active ? 'Active' : 'Completed',
      statusColor: r.is_active ? '#22c55e' : '#64748b',
      timestamp: String(r.start_time ?? ''),
    })
  })

  ;(visitorRes.data ?? []).forEach((r: Record<string, unknown>) => {
    const acts = Array.isArray(r.activities) ? (r.activities as string[]) : []
    records.push({
      id: String(r.id),
      type: 'visitor',
      typeLabel: 'Visitor Survey',
      formCode: 'FR-FORM-06',
      color: '#8b5cf6',
      title: typeof r.country_of_origin === 'string' ? r.country_of_origin : 'Visitor Response',
      summary: `${acts.length} activities${typeof r.expenditure_xcd === 'number' ? ` · XCD $${r.expenditure_xcd}` : ''}${typeof r.satisfaction_rating === 'number' ? ` · ${r.satisfaction_rating}/5 ★` : ''}`,
      statusBadge: 'Submitted',
      statusColor: '#8b5cf6',
      timestamp: String(r.surveyed_at ?? ''),
    })
  })

  ;(csRes.data ?? []).forEach((r: Record<string, unknown>) => {
    const isWildlife = r.report_type === 'wildlife_sighting'
    const valStatus = typeof r.validation_status === 'string' ? r.validation_status : 'pending'
    records.push({
      id: String(r.id),
      type: isWildlife ? 'wildlife' : 'incident',
      typeLabel: isWildlife ? 'Wildlife' : 'Incident',
      formCode: isWildlife ? 'FR-FORM-07' : 'FR-FORM-08',
      color: isWildlife ? '#22c55e' : '#ef4444',
      title: isWildlife
        ? String(r.species_type ?? 'Wildlife Sighting')
        : String(r.incident_type ?? 'Environmental Incident').replace(/_/g, ' '),
      summary: isWildlife
        ? `Count: ${Number(r.species_count) || 1}`
        : `Severity ${Number(r.severity) || 3}/5`,
      statusBadge: valStatus === 'approved' ? 'Accepted' : valStatus,
      statusColor: valStatus === 'approved' ? '#10b981' : valStatus === 'rejected' ? '#ef4444' : '#f59e0b',
      timestamp: String(r.created_at ?? ''),
    })
  })

  records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '4px' }}>Data Collection Forms</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{visible.length} form{visible.length !== 1 ? 's' : ''} available for your role · All support offline submission via sync queue</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {visible.map(form => (
          <Link key={form.id} href={form.href}
            style={{ display: 'block', textDecoration: 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '18px 20px', transition: 'border-color 150ms, background 150ms', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${form.color}18`, border: `1px solid ${form.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={form.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={form.icon}/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '2px' }}>{form.title}</div>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: form.color }}>{form.id}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
            <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{form.desc}</p>
          </Link>
        ))}
      </div>

      {visible.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No forms are available for your current role.
        </div>
      )}

      <DataCollectionRecordsList records={records} />
    </div>
  )
}

