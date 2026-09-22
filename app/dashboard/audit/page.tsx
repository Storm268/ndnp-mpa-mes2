'use client'
import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ACTION_LABELS, TABLE_LABELS } from '@/lib/audit/log-action'

type AuditEntry = {
  id: string
  user_id: string | null
  user_email: string | null
  user_role: string | null
  action_type: string
  table_name: string | null
  record_id: string | null
  after_value: Record<string,unknown> | null
  before_value: Record<string,unknown> | null
  ip_address: string | null
  created_at: string
}

const ACTION_COLORS: Record<string,string> = {
  create:              '#22c55e',
  update:              '#f59e0b',
  delete:              '#ef4444',
  login:               '#4fb3e8',
  logout:              '#64748b',
  failed_login:        '#dc2626',
  password_change:     '#8b5cf6',
  permission_change:   '#f97316',
  user_created:        '#0d9488',
  validation_decision: '#6366f1',
}

const ROLE_LABELS: Record<string,string> = {
  system_admin: 'Sys Admin', park_manager: 'Manager',
  scientist: 'Scientist', ranger: 'Ranger',
  read_only: 'Read-Only', visitor: 'Visitor',
}

const PAGE_SIZE = 50

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase', padding:'2px 7px', borderRadius:'3px', background:`${color}18`, border:`1px solid ${color}30`, color, flexShrink:0, whiteSpace:'nowrap' }}>{text}</span>
  )
}

export default function AuditPage() {
  const now   = new Date()
  const ago30 = new Date(now); ago30.setDate(ago30.getDate() - 30)

  const [entries,    setEntries]    = useState<AuditEntry[]>([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(0)
  const [filterUser, setFilterUser] = useState('')
  const [filterAction,setFilterAction] = useState('')
  const [filterTable, setFilterTable]  = useState('')
  const [startDate,  setStartDate]  = useState(ago30.toISOString().split('T')[0])
  const [endDate,    setEndDate]    = useState(now.toISOString().split('T')[0])
  const [isAdmin,    setIsAdmin]    = useState<boolean | null>(null)
  const [stats,      setStats]      = useState<{today:number; users:number; creates:number; updates:number} | null>(null)

  // ── Auth check: only system_admin can view ──────────────────────────────
  useEffect(() => {
    createClient().from('profiles').select('role').then(({ data }) => {
      setIsAdmin(data?.[0]?.role === 'system_admin')
    })
  }, [])

  // ── Fetch audit entries ───────────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const startIso = new Date(startDate).toISOString()
    const endIso   = new Date(endDate + 'T23:59:59').toISOString()

    let q = sb.from('audit_log').select('*', { count: 'exact' })
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filterUser)   q = q.ilike('user_email', `%${filterUser}%`)
    if (filterAction) q = q.eq('action_type', filterAction)
    if (filterTable)  q = q.eq('table_name', filterTable)

    const { data, count, error } = await q
    if (!error) {
      setEntries((data ?? []) as AuditEntry[])
      setTotal(count ?? 0)
    }

    // Stats
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)
    const [todayR, allInRange] = await Promise.all([
      sb.from('audit_log').select('*', { count:'exact', head:true }).gte('created_at', todayStart.toISOString()),
      sb.from('audit_log').select('action_type, user_email').gte('created_at', startIso).lte('created_at', endIso),
    ])
    const allData = allInRange.data ?? []
    const uniqueUsers = new Set(allData.map((r: {user_email:string|null}) => r.user_email).filter(Boolean)).size
    const creates  = allData.filter((r: {action_type:string}) => r.action_type === 'create').length
    const updates  = allData.filter((r: {action_type:string}) => r.action_type === 'update').length
    setStats({ today: todayR.count ?? 0, users: uniqueUsers, creates, updates })

    setLoading(false)
  }, [startDate, endDate, filterUser, filterAction, filterTable, page])

  useEffect(() => { if (isAdmin) fetchEntries() }, [fetchEntries, isAdmin])

  // ── CSV export ─────────────────────────────────────────────────────────────
  async function exportCSV() {
    const sb = createClient()
    const startIso = new Date(startDate).toISOString()
    const endIso   = new Date(endDate + 'T23:59:59').toISOString()
    let q = sb.from('audit_log').select('*').gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false }).limit(10000)
    if (filterUser)   q = q.ilike('user_email', `%${filterUser}%`)
    if (filterAction) q = q.eq('action_type', filterAction)
    if (filterTable)  q = q.eq('table_name', filterTable)
    const { data } = await q
    if (!data) return

    const rows = [
      ['Timestamp','User Email','Role','Action','Table','Description','Record ID','IP Address'],
      ...(data as AuditEntry[]).map(e => [
        e.created_at,
        e.user_email ?? '',
        e.user_role ?? '',
        ACTION_LABELS[e.action_type] ?? e.action_type,
        TABLE_LABELS[e.table_name ?? ''] ?? e.table_name ?? '',
        String(e.after_value?.description ?? ''),
        e.record_id ?? '',
        e.ip_address ?? '',
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type:'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `NDNP-AuditLog-${startDate}-${endDate}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const S = { padding:'8px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'7px', fontSize:'0.82rem', color:'var(--text)', outline:'none', boxSizing:'border-box' as const }

  // ── Not admin guard ───────────────────────────────────────────────────────
  if (isAdmin === false) return (
    <div style={{ padding:'40px 32px', maxWidth:'600px' }}>
      <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'10px', padding:'28px', textAlign:'center' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" style={{ display:'block', margin:'0 auto 12px' }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <div style={{ fontSize:'1rem', fontWeight:700, color:'#ef4444', marginBottom:'6px' }}>Access Restricted</div>
        <div style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>The Audit Log is accessible to System Administrators only (FR-AUDIT-01).</div>
      </div>
    </div>
  )

  if (isAdmin === null) return (
    <div style={{ padding:'40px 32px', color:'var(--text-muted)', fontSize:'0.85rem' }}>Checking access…</div>
  )

  return (
    <div style={{ padding:'22px 28px', maxWidth:'1200px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
            <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--text)', letterSpacing:'-0.02em' }}>Audit Log</h1>
            <span style={{ fontSize:'0.65rem', fontWeight:700, padding:'2px 8px', borderRadius:'3px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>ADMIN ONLY</span>
          </div>
          <p style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>FR-AUDIT-01 · Immutable compliance trail · All user actions, form submissions, and system events</p>
        </div>
        <button onClick={exportCSV}
          style={{ display:'flex', alignItems:'center', gap:'7px', padding:'9px 18px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'7px', cursor:'pointer', fontSize:'0.8rem', fontWeight:600, color:'var(--teal)', transition:'all 150ms' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor='rgba(13,148,136,0.5)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor='var(--border)')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          Export CSV
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'10px', marginBottom:'20px' }}>
          {[
            { val: total,         label:'Total Entries',    color:'var(--text)',  sub:'in period' },
            { val: stats.today,   label:'Today\'s Activity', color:'var(--teal)',  sub:'all actions' },
            { val: stats.users,   label:'Unique Users',     color:'var(--sky)',   sub:'active in period' },
            { val: stats.creates, label:'Creates / Submits', color:'#22c55e',     sub:'form + record' },
            { val: stats.updates, label:'Updates / Actions', color:'#f59e0b',     sub:'ack + resolve' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding:'14px 16px' }}>
              <div style={{ fontSize:'1.7rem', fontWeight:800, color:s.color, lineHeight:1, letterSpacing:'-0.03em', marginBottom:'4px' }}>{s.val}</div>
              <div style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text)', marginBottom:'1px' }}>{s.label}</div>
              <div style={{ fontSize:'0.65rem', color:'var(--text-muted)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="card" style={{ padding:'14px 16px', marginBottom:'16px', display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
        <input placeholder="Filter by user email…" value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(0) }}
          style={{ ...S, flex:1, minWidth:'160px' }} />

        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0) }}
          style={{ ...S, minWidth:'160px', cursor:'pointer' }}>
          <option value="">All action types</option>
          {Object.entries(ACTION_LABELS).slice(0,10).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select value={filterTable} onChange={e => { setFilterTable(e.target.value); setPage(0) }}
          style={{ ...S, minWidth:'180px', cursor:'pointer' }}>
          <option value="">All tables</option>
          {Object.entries(TABLE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(0) }}
          style={{ ...S, width:'140px' }} />
        <input type="date" value={endDate}   onChange={e => { setEndDate(e.target.value);   setPage(0) }}
          style={{ ...S, width:'140px' }} />

        {(filterUser || filterAction || filterTable) && (
          <button onClick={() => { setFilterUser(''); setFilterAction(''); setFilterTable(''); setPage(0) }}
            style={{ padding:'8px 12px', background:'transparent', border:'1px solid var(--border)', borderRadius:'7px', cursor:'pointer', fontSize:'0.75rem', color:'var(--text-muted)' }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow:'hidden', marginBottom:'14px' }}>
        {loading ? (
          <div style={{ padding:'40px', textAlign:'center', color:'var(--text-muted)', fontSize:'0.85rem' }}>Loading audit log…</div>
        ) : entries.length === 0 ? (
          <div style={{ padding:'40px', textAlign:'center', color:'var(--text-muted)', fontSize:'0.85rem' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display:'block', margin:'0 auto 10px', opacity:0.4 }}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/></svg>
            No audit entries for this period / filter combination.
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.78rem' }}>
            <thead>
              <tr style={{ background:'var(--surface2)', borderBottom:'1px solid var(--border)' }}>
                {['Timestamp','User','Role','Action','Table / Context','Description / Record','IP'].map(h => (
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const actionColor = ACTION_COLORS[e.action_type] ?? 'var(--text-muted)'
                const actionLabel = ACTION_LABELS[e.action_type] ?? e.action_type
                const tableLabel  = TABLE_LABELS[e.table_name ?? ''] ?? e.table_name ?? '—'
                const description = String(e.after_value?.description ?? '')
                const ts = new Date(e.created_at)

                return (
                  <tr key={e.id} style={{ borderBottom:'1px solid rgba(26,58,82,0.4)', background: i % 2 === 0 ? 'transparent' : 'rgba(13,32,53,0.3)', transition:'background 150ms' }}>

                    {/* Timestamp */}
                    <td style={{ padding:'8px 12px', whiteSpace:'nowrap', fontFamily:'DM Mono,monospace', fontSize:'0.68rem', color:'var(--text-muted)' }}>
                      <div>{ts.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' })}</div>
                      <div style={{ color:'var(--muted)' }}>{ts.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</div>
                    </td>

                    {/* User */}
                    <td style={{ padding:'8px 12px', maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      <div style={{ fontSize:'0.75rem', fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis' }}>{e.user_email ?? 'System'}</div>
                    </td>

                    {/* Role */}
                    <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>
                      {e.user_role && <Badge text={ROLE_LABELS[e.user_role] ?? e.user_role} color={e.user_role === 'system_admin' ? '#ef4444' : e.user_role === 'park_manager' ? '#f59e0b' : '#4fb3e8'} />}
                    </td>

                    {/* Action */}
                    <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>
                      <Badge text={actionLabel} color={actionColor} />
                    </td>

                    {/* Table */}
                    <td style={{ padding:'8px 12px', fontSize:'0.72rem', color:'var(--text-muted)', maxWidth:'140px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {tableLabel}
                    </td>

                    {/* Description */}
                    <td style={{ padding:'8px 12px', maxWidth:'220px' }}>
                      {description && <div style={{ fontSize:'0.72rem', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{description}</div>}
                      {e.record_id && <div style={{ fontFamily:'DM Mono,monospace', fontSize:'0.6rem', color:'var(--text-muted)', marginTop:'1px' }}>{e.record_id.slice(0,12)}…</div>}
                    </td>

                    {/* IP */}
                    <td style={{ padding:'8px 12px', fontFamily:'DM Mono,monospace', fontSize:'0.65rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                      {e.ip_address ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0' }}>
          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of <b style={{ color:'var(--text)' }}>{total}</b> entries
          </div>
          <div style={{ display:'flex', gap:'6px' }}>
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
              style={{ padding:'6px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1, fontSize:'0.78rem', color:'var(--text)' }}>
              ← Previous
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(0, Math.min(totalPages - 5, page - 2)) + i
              return (
                <button key={p} onClick={() => setPage(p)}
                  style={{ padding:'6px 10px', background: p === page ? 'var(--teal)' : 'var(--surface)', border:`1px solid ${p === page ? 'var(--teal)' : 'var(--border)'}`, borderRadius:'6px', cursor:'pointer', fontSize:'0.78rem', color: p === page ? '#fff' : 'var(--text)', fontWeight: p === page ? 700 : 400 }}>
                  {p + 1}
                </button>
              )
            })}
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
              style={{ padding:'6px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1, fontSize:'0.78rem', color:'var(--text)' }}>
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Immutability notice */}
      <div style={{ marginTop:'16px', background:'rgba(59,130,246,0.05)', border:'1px solid rgba(59,130,246,0.15)', borderRadius:'8px', padding:'11px 16px', fontSize:'0.73rem', color:'#7fb3d8', lineHeight:1.6 }}>
        <b style={{ color:'#60a5fa' }}>FR-AUDIT-04 Compliance:</b> Records in this audit log are protected by Supabase database-level immutability rules. No role — including System Administrator — can update or delete audit entries once written. Records are retained for a minimum of 7 years. Export to CSV is available to System Administrators only.
      </div>
    </div>
  )
}

