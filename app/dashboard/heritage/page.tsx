import { createClient } from '@/lib/supabase/server'

const CONDITION_LABEL: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  2: { label: 'Poor',     color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  3: { label: 'Fair',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  4: { label: 'Good',     color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  5: { label: 'Excellent',color: '#0d9488', bg: 'rgba(13,148,136,0.12)' },
}

function ConditionDots({ rating, max = 5 }: { rating: number; max?: number }) {
  const c = CONDITION_LABEL[rating]
  return (
    <div style={{ display: 'flex', gap: '3px', marginTop: '5px' }}>
      {Array.from({ length: max }, (_, i) => (
        <div key={i} style={{ width: '14px', height: '5px', borderRadius: '2px', background: i < rating ? c?.color ?? 'var(--text-muted)' : 'var(--surface2)' }} />
      ))}
    </div>
  )
}

export default async function HeritageDashboard() {
  const supabase = await createClient()

  const [{ data: sites }, { data: assessments }, { data: maintenance }] = await Promise.all([
    supabase.from('heritage_sites')
      .select('id, site_code, name, site_type, current_condition, last_assessed_at, is_active')
      .eq('is_active', true)
      .order('current_condition', { ascending: true }),
    supabase.from('heritage_assessments')
      .select('id, site_id, overall_condition, assessor_name, narrative_notes, assessed_at, heritage_sites(name, site_code)')
      .order('assessed_at', { ascending: false })
      .limit(10),
    supabase.from('maintenance_items')
      .select('id, title, priority, status, due_date, site_id, heritage_sites(name, site_code)')
      .eq('status', 'open')
      .order('priority', { ascending: true })
      .limit(15),
  ])

  const criticalPoor = (sites ?? []).filter((s: Record<string, unknown>) => typeof s.current_condition === 'number' && (s.current_condition as number) <= 2).length
  const fairCount    = (sites ?? []).filter((s: Record<string, unknown>) => s.current_condition === 3).length
  const goodExcCount = (sites ?? []).filter((s: Record<string, unknown>) => typeof s.current_condition === 'number' && (s.current_condition as number) >= 4).length

  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const sortedMaint = [...(maintenance ?? [])].sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
    (priorityOrder[String(a.priority)] ?? 9) - (priorityOrder[String(b.priority)] ?? 9)
  )

  const priorityColor: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e' }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '4px' }}>Heritage Condition</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>FR-DASH-04 · Site-by-site condition ratings & priority maintenance queue</p>
      </div>

      {/* Summary metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {[
          { val: criticalPoor, label: 'Critical / Poor',  color: criticalPoor > 0 ? '#ef4444' : '#22c55e', sub: 'Condition 1-2' },
          { val: fairCount,    label: 'Fair Condition',    color: '#f59e0b', sub: 'Condition 3' },
          { val: goodExcCount, label: 'Good / Excellent',  color: '#22c55e', sub: 'Condition 4-5' },
          { val: (maintenance ?? []).filter((m: Record<string, unknown>) => m.priority === 'critical').length, label: 'Critical Maintenance', color: '#ef4444', sub: 'Urgent action needed' },
          { val: (maintenance ?? []).length, label: 'Open Work Items', color: '#f59e0b', sub: 'Total open queue' },
        ].map(m => (
          <div key={m.label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: m.color, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: '5px' }}>{m.val}</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{m.label}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Heritage site condition grid */}
      <h2 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>Site Condition Grid</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', marginBottom: '24px' }}>
        {(sites ?? []).length === 0 ? (
          <div className="card" style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No heritage sites configured yet.</div>
        ) : (sites ?? []).map((s: Record<string, unknown>) => {
          const rating = typeof s.current_condition === 'number' ? s.current_condition : 0
          const cond = CONDITION_LABEL[rating] ?? { label: 'Unknown', color: 'var(--text-muted)', bg: 'var(--surface2)' }
          const lastAssessed = typeof s.last_assessed_at === 'string' ? new Date(s.last_assessed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not assessed'
          return (
            <div key={String(s.id)} className="card" style={{ padding: '16px 18px', borderLeft: `3px solid ${cond.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--sky)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{String(s.site_code)}</div>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: '3px', color: cond.color, background: cond.bg }}>{cond.label}</span>
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', marginBottom: '2px' }}>{String(s.name)}</div>
              {typeof s.site_type === 'string' && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'capitalize' }}>{s.site_type.replace(/_/g, ' ')}</div>}
              <ConditionDots rating={rating} />
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px' }}>Last assessed: {lastAssessed}</div>
            </div>
          )
        })}
      </div>

      {/* Priority Maintenance Queue */}
      <h2 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>Priority Maintenance Queue</h2>
      <div className="card" style={{ overflow: 'hidden', marginBottom: '24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Priority', 'Item', 'Site', 'Due Date'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedMaint.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '16px 14px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No open maintenance items.</td></tr>
            ) : sortedMaint.map((m: Record<string, unknown>) => {
              const hs = m.heritage_sites as Record<string, string> | null
              const col = priorityColor[String(m.priority)] ?? 'var(--text-muted)'
              const due = typeof m.due_date === 'string' ? new Date(m.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
              const isOverdue = typeof m.due_date === 'string' && new Date(m.due_date) < new Date()
              return (
                <tr key={String(m.id)} style={{ borderBottom: '1px solid rgba(26,58,82,0.5)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: '3px', color: col, background: `${col}18` }}>{String(m.priority)}</span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 500 }}>{String(m.title)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {hs ? (
                      <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--sky)', textTransform: 'uppercase' }}>{hs.site_code}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hs.name}</div>
                      </div>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '0.75rem', color: isOverdue ? '#ef4444' : 'var(--text-muted)', fontWeight: isOverdue ? 700 : 400 }}>
                    {isOverdue ? '⚠ ' : ''}{due}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Recent Assessments */}
      <h2 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>Recent Assessments</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {(assessments ?? []).length === 0 ? (
          <div className="card" style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No assessments recorded yet. Field teams can submit FR-FORM-03.</div>
        ) : (assessments ?? []).map((a: Record<string, unknown>) => {
          const hs = a.heritage_sites as Record<string, string> | null
          const cond = CONDITION_LABEL[typeof a.overall_condition === 'number' ? a.overall_condition : 0] ?? { label: 'Unknown', color: 'var(--text-muted)' }
          const date = typeof a.assessed_at === 'string' ? new Date(a.assessed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
          return (
            <div key={String(a.id)} className="card" style={{ padding: '12px 16px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '40px' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: cond.color, lineHeight: 1 }}>{typeof a.overall_condition === 'number' ? a.overall_condition : '?'}</div>
                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rating</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{hs?.name ?? 'Unknown Site'}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>by {typeof a.assessor_name === 'string' ? a.assessor_name : 'Unknown'} · {date}</div>
                {typeof a.narrative_notes === 'string' && a.narrative_notes && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.narrative_notes}</div>
                )}
              </div>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.05em', padding: '2px 7px', borderRadius: '3px', color: cond.color, background: `${cond.color}18`, flexShrink: 0 }}>{cond.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

