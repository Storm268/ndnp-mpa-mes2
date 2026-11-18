'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient, ROLE_HOME, type UserRole } from '@/lib/supabase/client'
import { signOutAndRedirect } from '@/lib/supabase/auth-helpers'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'
import MapLoader from '@/components/map/MapLoader'
import { getAllReports } from '@/lib/offline/db'
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  MapPin,
  FileText,
  X,
  WifiOff,
  ClipboardList,
  Map as MapIcon,
  Plus,
  LogOut,
  AlertCircle,
  Loader2,
} from 'lucide-react'

interface CitizenReport {
  id: string
  reference_id?: string | null
  title: string
  report_type: string
  incident_type?: string | null
  severity: number
  status: string
  validator_notes?: string | null
  validated_at?: string | null
  gps_lat?: number | null
  gps_lng?: number | null
  created_at: string
  description: string
  source?: 'online' | 'offline'
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; border: string; summary: string }
> = {
  pending: {
    label: 'Pending Review',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.3)',
    summary: 'Your report has been received and is awaiting review by park rangers or managers.',
  },
  approved: {
    label: 'Accepted',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.3)',
    summary: 'Your report has been reviewed and accepted by park operations.',
  },
  resolved: {
    label: 'Resolved',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.3)',
    summary: 'Your report has been reviewed and marked resolved by park operations.',
  },
  rejected: {
    label: 'Rejected',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.3)',
    summary: 'Your report was reviewed and closed/rejected. See reviewer notes below if provided.',
  },
  offline_pending: {
    label: 'Saved Offline',
    color: '#00bcd4',
    bg: 'rgba(0,188,212,0.12)',
    border: 'rgba(0,188,212,0.3)',
    summary: 'Saved locally on your device and will upload automatically once online.',
  },
}

function getStatusMeta(status: string) {
  return (
    STATUS_META[status] ?? {
      label: status?.replace(/_/g, ' ') || 'Pending Review',
      color: '#6b7280',
      bg: 'rgba(107,114,128,0.12)',
      border: 'rgba(107,114,128,0.3)',
      summary: 'Report status recorded in system.',
    }
  )
}

const SEV_COLOR = (s: number) =>
  ['', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444'][s] || '#6b7280'

const LOCAL_REFS_KEY = 'ndnp_citizen_report_ids'

function getStoredReportIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_REFS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveStoredReportId(id: string) {
  if (typeof window === 'undefined' || !id) return
  try {
    const existing = getStoredReportIds()
    const next = [id, ...existing.filter((x) => x !== id)].slice(0, 50)
    localStorage.setItem(LOCAL_REFS_KEY, JSON.stringify(next))
  } catch {}
}

export default function CitizenPortalPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ email: string; full_name: string; role?: UserRole } | null>(null)
  const [reports, setReports] = useState<CitizenReport[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'map' | 'reports'>('map')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedReport, setSelectedReport] = useState<CitizenReport | null>(null)

  // Reference ID Lookup state
  const [lookupRef, setLookupRef] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookupResult, setLookupResult] = useState<CitizenReport | null>(null)

  // Check URL query param (?tab=reports) on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('tab') === 'reports') {
        setActiveTab('reports')
      }
      const refQuery = params.get('ref')
      if (refQuery) {
        setActiveTab('reports')
        setLookupRef(refQuery)
      }
    }
  }, [])

  const fetchCitizenReports = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const storedIds = getStoredReportIds()
      const query = storedIds.length > 0 ? `?ids=${encodeURIComponent(storedIds.join(','))}` : ''
      const res = await fetch(`/api/reports/status${query}`, {
        cache: 'no-store',
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      })
      let onlineReports: CitizenReport[] = []
      if (res.ok) {
        const json = await res.json()
        onlineReports = ((json.reports ?? []) as CitizenReport[]).map((r) => ({
          ...r,
          source: 'online',
        }))
      }

      // Include any unsynced offline reports from IndexedDB
      let offlineReports: CitizenReport[] = []
      try {
        const offline = await getAllReports()
        offlineReports = offline
          .filter((p) => p.status !== 'synced')
          .map((p) => ({
            id: p.id,
            reference_id: (p.payload.reference_id as string) || null,
            title:
              (p.payload.title as string) ||
              `${p.form_type.replace(/_/g, ' ')} Report`,
            report_type: (p.payload.report_type as string) || p.form_type,
            incident_type: (p.payload.incident_type as string) || null,
            severity: Number(p.payload.severity) || 2,
            status: 'offline_pending',
            validator_notes: null,
            validated_at: null,
            gps_lat: typeof p.payload.gps_lat === 'number' ? p.payload.gps_lat : null,
            gps_lng: typeof p.payload.gps_lng === 'number' ? p.payload.gps_lng : null,
            created_at: p.created_at,
            description:
              (p.payload.description as string) || 'Saved offline on this device.',
            source: 'offline' as const,
          }))
      } catch {}

      const merged = [...offlineReports, ...onlineReports]
      setReports(merged)
      setSelectedReport((curr) => (curr ? merged.find((r) => r.id === curr.id) ?? curr : null))
    } catch {
      // Keep existing reports on transient error
    } finally {
      if (showSpinner) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user: u },
      } = await supabase.auth.getUser()

      if (u) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, role')
          .eq('id', u.id)
          .maybeSingle()

        const resolvedRole = (profile?.role as UserRole) || 'citizen'
        setUser({
          email: profile?.email || u.email || '',
          full_name: profile?.full_name || u.email || 'Citizen',
          role: resolvedRole,
        })
      } else {
        setUser(null)
      }

      await fetchCitizenReports(false)
      setLoading(false)
    }
    load()
  }, [router, fetchCitizenReports])

  // Real-time status updates + focus/interval sync when park staff accept/resolve/reject a report
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('citizen-report-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'citizen_science_reports' },
        () => {
          fetchCitizenReports(false)
        }
      )
      .subscribe()

    const onFocus = () => fetchCitizenReports(false)
    window.addEventListener('focus', onFocus)
    const pollId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchCitizenReports(false)
      }
    }, 15000)

    return () => {
      supabase.removeChannel(ch)
      window.removeEventListener('focus', onFocus)
      clearInterval(pollId)
    }
  }, [fetchCitizenReports])

  async function handleLookupByRef(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = lookupRef.trim()
    if (!cleaned) {
      setLookupError('Enter your Reference ID (e.g. INC-...) to check its status.')
      return
    }
    setLookupLoading(true)
    setLookupError(null)
    setLookupResult(null)
    try {
      const res = await fetch(`/api/reports/status?ref=${encodeURIComponent(cleaned)}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok || !json.report) {
        setLookupError(json.error || 'No report found with that Reference ID.')
        setLookupLoading(false)
        return
      }
      const found = { ...(json.report as CitizenReport), source: 'online' as const }
      setLookupResult(found)
      saveStoredReportId(found.id)
      await fetchCitizenReports(false)
    } catch {
      setLookupError('Unable to look up report right now. Please try again.')
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleLogout() {
    setUser(null)
    await signOutAndRedirect('/')
  }

  const pendingCount = reports.filter((r) => r.status === 'pending' || r.status === 'offline_pending').length
  const approvedCount = reports.filter((r) => r.status === 'approved' || r.status === 'resolved').length
  const rejectedCount = reports.filter((r) => r.status === 'rejected').length

  const filteredReports = reports.filter((r) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'pending') return r.status === 'pending' || r.status === 'offline_pending'
    if (statusFilter === 'approved') return r.status === 'approved' || r.status === 'resolved'
    return r.status === statusFilter
  })

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading your portal...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-jakarta)' }}>
      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
          background: 'var(--header-bg)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/dashboard/citizen" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #00bcd4, #0077a8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945" />
              </svg>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>NDNP Marine Park</span>
          </Link>
          <span style={{ color: 'var(--border2)' }}>/</span>
          <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: '600' }}>Citizen Portal</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: activeTab === 'map' ? 'var(--teal)' : 'var(--text-dim)',
              padding: '6px 12px',
              borderRadius: '6px',
              border: activeTab === 'map' ? '1px solid rgba(0, 188, 212, 0.35)' : '1px solid var(--border)',
              background: activeTab === 'map' ? 'rgba(0, 188, 212, 0.1)' : 'var(--surface2)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <MapIcon size={14} />
            <span>Interactive Map</span>
          </button>

          {user && (
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: activeTab === 'reports' ? 'var(--teal)' : 'var(--text-dim)',
                padding: '6px 12px',
                borderRadius: '6px',
                border: activeTab === 'reports' ? '1px solid rgba(0, 188, 212, 0.35)' : '1px solid var(--border)',
                background: activeTab === 'reports' ? 'rgba(0, 188, 212, 0.1)' : 'var(--surface2)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <ClipboardList size={14} />
              <span>My Reports ({reports.length})</span>
            </button>
          )}

          <ThemeToggle />

          {user ? (
            <>
              {user.role && user.role !== 'citizen' && (
                <Link
                  href={ROLE_HOME[user.role] || '/dashboard/operational'}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '7px',
                    border: '1px solid rgba(0, 188, 212, 0.35)',
                    background: 'rgba(0, 188, 212, 0.1)',
                    color: 'var(--teal)',
                    fontSize: '12px',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Back to Operations
                </Link>
              )}
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
                  gap: '6px',
                }}
              >
                <LogOut size={14} />
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
                  textDecoration: 'none',
                }}
              >
                Citizen &amp; Staff Sign In
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
                  textDecoration: 'none',
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: '4px' }}>
              {user ? `Welcome back, ${user.full_name.split(' ')[0]}` : 'NDNP Citizen Portal'}
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Explore the real-time GIS map, report marine incidents, and track the live review status of your reports.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <ClipboardList size={15} color="#00bcd4" />
              <span>Check Report Status</span>
            </button>

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
              <Plus size={15} />
              <span>Report Incident / Sighting</span>
            </Link>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <div style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(0,188,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapIcon size={18} color="#00bcd4" />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--teal)' }}>Real-Time GIS</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Esri Satellite &amp; Shapefile Zones</div>
            </div>
          </div>

          {user && (
            <>
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveTab('reports')
                  setStatusFilter('pending')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveTab('reports')
                    setStatusFilter('pending')
                  }
                }}
                style={{
                  padding: '16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: 'var(--card-shadow)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock size={18} color="#f59e0b" />
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#f59e0b' }}>{pendingCount}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pending Review</div>
                </div>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveTab('reports')
                  setStatusFilter('approved')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveTab('reports')
                    setStatusFilter('approved')
                  }
                }}
                style={{
                  padding: '16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: 'var(--card-shadow)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle2 size={18} color="#10b981" />
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>{approvedCount}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Accepted / Resolved</div>
                </div>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveTab('reports')
                  setStatusFilter('all')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveTab('reports')
                    setStatusFilter('all')
                  }
                }}
                style={{
                  padding: '16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: 'var(--card-shadow)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ClipboardList size={18} color="#ef4444" />
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#ef4444' }}>{reports.length}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>My Submitted Reports</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <button
            type="button"
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
              fontFamily: 'inherit',
            }}
          >
            <MapIcon size={15} />
            <span>Park GIS Map</span>
          </button>

          {user && (
            <button
              type="button"
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
                fontFamily: 'inherit',
              }}
            >
              <ClipboardList size={15} />
              <span>My Reports &amp; Status ({reports.length})</span>
            </button>
          )}
        </div>

        {/* Tab 1: Park GIS Map */}
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

        {/* Tab 2: My Reports & Live Status */}
        {activeTab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Reference ID Lookup Card */}
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                padding: '18px 20px',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    Track Report Status by Reference ID
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Submitted an anonymous report or using a different device? Enter your Reference ID (e.g. INC-...) to check its live status.
                  </p>
                </div>
              </div>

              <form onSubmit={handleLookupByRef} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                  <input
                    type="text"
                    value={lookupRef}
                    onChange={(e) => setLookupRef(e.target.value)}
                    placeholder="Enter Reference ID (e.g. INC-MVH03GSM)"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface2)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      outline: 'none',
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={lookupLoading}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #00bcd4, #0077a8)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: lookupLoading ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: 'inherit',
                  }}
                >
                  {lookupLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  <span>Check Status</span>
                </button>
              </form>

              {lookupError && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#f87171',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={14} />
                  <span>{lookupError}</span>
                </div>
              )}

              {lookupResult && (
                <div
                  onClick={() => setSelectedReport(lookupResult)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedReport(lookupResult)
                  }}
                  style={{
                    marginTop: '12px',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: 'var(--surface2)',
                    border: `1px solid ${getStatusMeta(lookupResult.status).border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{lookupResult.title}</span>
                      {lookupResult.reference_id && (
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--teal)', fontWeight: 700 }}>
                          {lookupResult.reference_id}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Submitted {new Date(lookupResult.created_at).toLocaleString()} · Click to view full status details
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: getStatusMeta(lookupResult.status).bg,
                      color: getStatusMeta(lookupResult.status).color,
                      border: `1px solid ${getStatusMeta(lookupResult.status).border}`,
                    }}
                  >
                    {getStatusMeta(lookupResult.status).label}
                  </span>
                </div>
              )}
            </div>

            {/* Reports List Header + Filters */}
            <div>
              <div
                style={{
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>
                    {user ? 'My Incident & Sighting Reports' : 'Looked-Up Reports'}
                  </h2>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(
                      [
                        { id: 'all', label: 'All', count: reports.length, color: 'var(--teal)' },
                        { id: 'pending', label: 'Pending', count: pendingCount, color: '#f59e0b' },
                        { id: 'approved', label: 'Accepted / Resolved', count: approvedCount, color: '#10b981' },
                        { id: 'rejected', label: 'Rejected', count: rejectedCount, color: '#ef4444' },
                      ] as const
                    ).map((tab) => {
                      const active = statusFilter === tab.id
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setStatusFilter(tab.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            border: active ? `1px solid ${tab.color}` : '1px solid var(--border)',
                            background: active ? 'var(--surface2)' : 'transparent',
                            color: active ? tab.color : 'var(--text-muted)',
                          }}
                        >
                          {tab.label} ({tab.count})
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    type="button"
                    disabled={refreshing}
                    onClick={() => fetchCitizenReports(true)}
                    style={{
                      padding: '6px 11px',
                      borderRadius: '7px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-dim)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: refreshing ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontFamily: 'inherit',
                    }}
                  >
                    <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                    <span>Refresh Status</span>
                  </button>
                  <Link href="/report" style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444', textDecoration: 'none' }}>
                    + Submit Another Report
                  </Link>
                </div>
              </div>

              {filteredReports.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '56px 32px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '14px',
                    boxShadow: 'var(--card-shadow)',
                  }}
                >
                  <div style={{ fontSize: '40px', marginBottom: '14px' }}>🐠</div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)', marginBottom: '8px' }}>
                    {reports.length === 0 ? 'No reports tracked yet' : `No ${statusFilter} reports`}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '22px' }}>
                    {reports.length === 0
                      ? 'Submit an incident report or enter a Reference ID above to check its review status.'
                      : 'Try selecting another status filter above.'}
                  </p>
                  <Link
                    href="/report"
                    style={{
                      padding: '10px 24px',
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: '8px',
                      color: '#f87171',
                      fontSize: '13px',
                      fontWeight: '600',
                      textDecoration: 'none',
                    }}
                  >
                    Report an Incident
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredReports.map((r) => {
                    const sm = getStatusMeta(r.status)
                    return (
                      <div
                        key={r.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedReport(r)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedReport(r)
                          }
                        }}
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderLeft: `3px solid ${sm.color}`,
                          borderRadius: '12px',
                          padding: '16px 20px',
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          gap: '12px',
                          alignItems: 'start',
                          boxShadow: 'var(--card-shadow)',
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>{r.title}</span>
                            {r.reference_id && (
                              <span
                                style={{
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  background: 'var(--surface2)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--teal)',
                                }}
                              >
                                {r.reference_id}
                              </span>
                            )}
                            <span
                              style={{
                                padding: '2px 7px',
                                borderRadius: '10px',
                                fontSize: '11px',
                                fontWeight: '700',
                                background: `${SEV_COLOR(r.severity)}20`,
                                color: SEV_COLOR(r.severity),
                                border: `1px solid ${SEV_COLOR(r.severity)}40`,
                              }}
                            >
                              Sev {r.severity}
                            </span>
                            {r.source === 'offline' && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  color: '#00bcd4',
                                  fontWeight: 600,
                                }}
                              >
                                <WifiOff size={11} /> Queued Offline
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            {r.report_type.replace(/_/g, ' ')} · Submitted {new Date(r.created_at).toLocaleDateString()}
                            {r.validated_at && ` · Reviewed ${new Date(r.validated_at).toLocaleDateString()}`}
                          </div>

                          <div
                            style={{
                              fontSize: '13px',
                              color: 'var(--text-dim)',
                              lineHeight: '1.5',
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {r.description}
                          </div>

                          {r.validator_notes && (
                            <div
                              style={{
                                marginTop: '8px',
                                padding: '7px 10px',
                                borderRadius: '7px',
                                background: 'var(--surface2)',
                                border: '1px solid var(--border)',
                                fontSize: '12px',
                                color: 'var(--text)',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '6px',
                              }}
                            >
                              <FileText size={13} color="#00bcd4" style={{ flexShrink: 0, marginTop: '2px' }} />
                              <span>
                                <b>Ranger Note:</b> {r.validator_notes}
                              </span>
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: sm.bg,
                              color: sm.color,
                              border: `1px solid ${sm.border}`,
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            {r.status === 'approved' ? (
                              <CheckCircle2 size={12} />
                            ) : r.status === 'rejected' ? (
                              <XCircle size={12} />
                            ) : (
                              <Clock size={12} />
                            )}
                            {sm.label}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--teal)', fontWeight: 600 }}>
                            View Status →
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Report Status Detail Modal */}
      {selectedReport && (
        <div
          onClick={() => setSelectedReport(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.72)',
            backdropFilter: 'blur(4px)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '580px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                    {selectedReport.title}
                  </h3>
                  {selectedReport.reference_id && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--teal)',
                      }}
                    >
                      {selectedReport.reference_id}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Submitted {new Date(selectedReport.created_at).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                aria-label="Close report status modal"
                style={{
                  padding: '6px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Status Banner & Progress Stepper */}
              {(() => {
                const sm = getStatusMeta(selectedReport.status)
                const isDone = selectedReport.status === 'approved' || selectedReport.status === 'resolved' || selectedReport.status === 'rejected'
                return (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: sm.bg,
                      border: `1px solid ${sm.border}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: sm.color, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {selectedReport.status === 'approved' || selectedReport.status === 'resolved' ? (
                          <CheckCircle2 size={16} />
                        ) : selectedReport.status === 'rejected' ? (
                          <XCircle size={16} />
                        ) : (
                          <Clock size={16} />
                        )}
                        Status: {sm.label}
                      </span>
                      {selectedReport.validated_at && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Updated {new Date(selectedReport.validated_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 12px', lineHeight: 1.5 }}>
                      {sm.summary}
                    </p>

                    {/* 3-step progress bar */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {[
                        { label: '1. Submitted', done: true },
                        { label: '2. Ranger Review', done: isDone, active: !isDone },
                        {
                          label:
                            selectedReport.status === 'resolved'
                              ? '3. Resolved'
                              : selectedReport.status === 'approved'
                                ? '3. Accepted'
                                : selectedReport.status === 'rejected'
                                  ? '3. Rejected'
                                  : '3. Decision',
                          done: isDone,
                        },
                      ].map((step) => (
                        <div
                          key={step.label}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            textAlign: 'center',
                            background: step.done ? 'var(--surface)' : 'transparent',
                            border: `1px solid ${step.done ? sm.border : 'var(--border)'}`,
                            color: step.done ? sm.color : step.active ? 'var(--text)' : 'var(--text-muted)',
                          }}
                        >
                          {step.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Ranger Review Notes */}
              {selectedReport.validator_notes && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                    Park Operations Review Note
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>
                    {selectedReport.validator_notes}
                  </div>
                </div>
              )}

              {/* Details */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Report Details
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-dim)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                  {selectedReport.description}
                </div>
                {typeof selectedReport.gps_lat === 'number' && typeof selectedReport.gps_lng === 'number' && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <MapPin size={12} color="#00bcd4" />
                    <span>
                      GPS: {selectedReport.gps_lat.toFixed(4)}, {selectedReport.gps_lng.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'flex-end',
                background: 'var(--surface2)',
                borderBottomLeftRadius: '16px',
                borderBottomRightRadius: '16px',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
