'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'
import MapLoader from '@/components/map/MapLoader'

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
  const [activeTab, setActiveTab] = useState<'map' | 'reports'>('map')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) {
        setUser(null)
        setLoading(false)
        return
      }

      const { data: profile } = await supabase.from('profiles').select('full_name, email, role').eq('id', u.id).single()
      if (profile?.role && profile.role !== 'citizen') {
        router.push('/dashboard/operational')
        return
      }
      setUser({ email: profile?.email || u.email || '', full_name: profile?.full_name || 'Citizen' })

      const { data: reps } = await supabase
        .from('citizen_science_reports')
        .select('id, report_type, incident_type, species_type, severity, validation_status, created_at, description')
        .eq('reporter_id', u.id)
        .order('created_at', { ascending: false })

      const mappedReps: Report[] = (reps || []).map((r) => ({
        id: r.id,
        title: r.incident_type
          ? r.incident_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
          : r.species_type || (r.report_type === 'wildlife_sighting' ? 'Wildlife Sighting' : 'Incident Report'),
        report_type: r.report_type,
        severity: r.severity || 2,
        status: r.validation_status || 'pending',
        created_at: r.created_at,
        description: r.description || '',
      }))

      setReports(mappedReps)
      setLoading(false)
    }
    load()
  }, [router])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    window.location.href = '/'
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading your portal...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-jakarta)' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', background: 'var(--header-bg)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/dashboard/citizen" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #00bcd4, #0077a8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945"/></svg>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>NDNP Marine Park</span>
          </Link>
          <span style={{ color: 'var(--border2)' }}>/</span>
          <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: '600' }}>Citizen Portal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => setActiveTab('map')}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--teal)',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(0, 188, 212, 0.3)',
              background: 'rgba(0, 188, 212, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <span>🗺️</span> Interactive Map
          </button>
          <ThemeToggle />
          {user ? (
            <>
              <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>{user.email}</span>
              <button
                onClick={handleLogout}
                title="Sign out of account"
                style={{
                  padding: '7px 14px',
                  border: '1px solid var(--border)',
                  borderRadius: '7px',
                  background: 'var(--surface2)',
                  color: 'var(--text-dim)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link
                href="/login"
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  background: 'linear-gradient(135deg, #00bcd4, #0077a8)',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  textDecoration: 'none'
                }}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: '12px',
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 24px' }}>
        {/* Welcome Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: '4px' }}>
              Welcome back, {user?.full_name.split(' ')[0]}
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Explore the real-time GIS map, monitor wildlife &amp; heritage conservation, and report marine incidents.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Link
              href="/report"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)',
              }}
            >
              <span>+</span>
              <span>Report Incident / Sighting</span>
            </Link>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <div style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(0,188,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '18px' }}>🗺️</span>
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--teal)' }}>Real-Time GIS</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Esri Satellite &amp; Shapefile Zones</div>
            </div>
          </div>

          <div style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '18px' }}>🐢</span>
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#22c55e' }}>Wildlife &amp; Heritage</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>UNESCO World Heritage tracking</div>
            </div>
          </div>

          <div style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '18px' }}>📋</span>
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#ef4444' }}>{reports.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>My Submitted Reports</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <button
            onClick={() => setActiveTab('map')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'map' ? 'rgba(0,188,212,0.15)' : 'transparent',
              color: activeTab === 'map' ? 'var(--teal)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🗺️</span>
            <span>Park GIS Map</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'reports' ? 'rgba(0,188,212,0.15)' : 'transparent',
              color: activeTab === 'reports' ? 'var(--teal)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>📋</span>
            <span>My Reports ({reports.length})</span>
          </button>
        </div>

        {/* Tab 1: Park GIS Map (The Admin Map for Citizen) */}
        {activeTab === 'map' && (
          <div style={{ marginBottom: '32px' }}>
            <div
              style={{
                height: '620px',
                width: '100%',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                boxShadow: 'var(--card-shadow)',
                position: 'relative',
              }}
            >
              <MapLoader isCitizenView={true} initialSidebarOpen={true} />
            </div>
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)', padding: '0 4px' }}>
              <span>Interactive GIS layers: Shapefile boundaries, UNESCO heritage monuments, water quality stations &amp; wildlife clusters.</span>
            </div>
          </div>
        )}

        {/* Tab 2: My Incident Reports Table */}
        {activeTab === 'reports' && (
          <div>
            <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>My Incident &amp; Sighting Reports</h2>
              <Link href="/report" style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444', textDecoration: 'none' }}>
                + Submit Another Report
              </Link>
            </div>
            {reports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 32px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: 'var(--card-shadow)' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>🐠</div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)', marginBottom: '8px' }}>No reports yet</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>Submit your first incident report to help protect the marine park.</p>
                <Link href="/report" style={{ padding: '10px 24px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#f87171', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
                  Report an Incident
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {reports.map(r => (
                  <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'start', boxShadow: 'var(--card-shadow)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>{r.title}</span>
                        <span style={{ padding: '2px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', background: `rgba(${SEV_COLOR(r.severity)}, 0.15)`, color: SEV_COLOR(r.severity), border: `1px solid ${SEV_COLOR(r.severity)}40` }}>Sev {r.severity}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        {r.report_type.replace(/_/g, ' ')} · {new Date(r.created_at).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: '1.5', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
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
          </div>
        )}
      </main>
    </div>
  )
}


