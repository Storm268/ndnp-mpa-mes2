'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Report {
  id: string
  title: string
  report_type: string
  severity: number
  status: string
  created_at: string
  description: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  under_review: '#00bcd4',
  resolved: '#10b981',
  dismissed: '#6b7280',
}

const SEV_COLOR = (s: number) => ['', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444'][s] || '#6b7280'

export default function CitizenPortalPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ email: string; full_name: string } | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push('/'); return }

      const { data: profile } = await supabase.from('profiles').select('full_name, email, role').eq('id', u.id).single()
      if (profile?.role !== 'citizen') {
        router.push('/dashboard/operational')
        return
      }
      setUser({ email: profile.email || u.email || '', full_name: profile.full_name || 'Citizen' })

      const { data: reps } = await supabase
        .from('citizen_science_reports')
        .select('id, title, report_type, severity, status, created_at, description')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false })
      setReports(reps || [])
      setLoading(false)
    }
    load()
  }, [router])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--ocean-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#5a7d94', fontSize: '14px' }}>Loading your portal...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ocean-deep)', fontFamily: 'var(--font-jakarta)' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', background: 'rgba(2,11,20,0.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #00bcd4, #0077a8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945"/></svg>
            </div>
            <span style={{ fontSize: '13px', color: '#5a7d94' }}>NDNP Marine Park</span>
          </Link>
          <span style={{ color: '#1e3a4f' }}>/</span>
          <span style={{ fontSize: '13px', color: '#e2f0f9', fontWeight: '600' }}>Citizen Portal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '13px', color: '#7aa3be' }}>{user?.email}</span>
          <button onClick={handleLogout} style={{ padding: '7px 14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', background: 'transparent', color: '#7aa3be', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
        </div>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 32px' }}>
        {/* Welcome */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', letterSpacing: '-0.3px', marginBottom: '6px' }}>
            Welcome, {user?.full_name.split(' ')[0]}
          </h1>
          <p style={{ fontSize: '14px', color: '#5a7d94' }}>Track your incident reports and stay informed about the marine park.</p>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '40px' }}>
          <Link href="/report" style={{ padding: '20px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#f87171', marginBottom: '2px' }}>New Report</div>
              <div style={{ fontSize: '12px', color: '#5a7d94' }}>Report a marine incident</div>
            </div>
          </Link>
          <div style={{ padding: '20px', background: 'rgba(0,188,212,0.06)', border: '1px solid rgba(0,188,212,0.2)', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(0,188,212,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#00bcd4" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#00bcd4' }}>{reports.length}</div>
              <div style={{ fontSize: '12px', color: '#5a7d94' }}>Total reports submitted</div>
            </div>
          </div>
        </div>

        {/* Reports Table */}
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>My Incident Reports</h2>
        </div>
        {reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 32px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🐠</div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#e2f0f9', marginBottom: '8px' }}>No reports yet</h3>
            <p style={{ fontSize: '14px', color: '#5a7d94', marginBottom: '24px' }}>Submit your first incident report to help protect the marine park.</p>
            <Link href="/report" style={{ padding: '10px 24px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#f87171', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
              Report an Incident
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {reports.map(r => (
              <div key={r.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#e2f0f9' }}>{r.title}</span>
                    <span style={{ padding: '2px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', background: `rgba(${SEV_COLOR(r.severity)}, 0.15)`, color: SEV_COLOR(r.severity), border: `1px solid ${SEV_COLOR(r.severity)}40` }}>Sev {r.severity}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#5a7d94', marginBottom: '6px' }}>
                    {r.report_type.replace(/_/g, ' ')} · {new Date(r.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: '13px', color: '#7aa3be', lineHeight: '1.5', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {r.description}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: `${STATUS_COLORS[r.status] || '#6b7280'}20`, color: STATUS_COLORS[r.status] || '#6b7280', border: `1px solid ${STATUS_COLORS[r.status] || '#6b7280'}40`, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                    {r.status?.replace(/_/g, ' ') || 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

