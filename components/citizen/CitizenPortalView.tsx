'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/theme-toggle'
import InteractiveMapLoader from '@/components/citizen/InteractiveMapLoader'
import GeofenceAlertBanner from '@/components/citizen/GeofenceAlertBanner'
import ExitSurveyModal from '@/components/citizen/ExitSurveyModal'
import { PWAInstallButton } from '@/components/pwa/PWAInstallButton'
import { useOffline } from '@/lib/offline/useOffline'
import {
  UNESCO_HERITAGE_SITES,
  CARIBBEAN_MARINE_SPECIES,
  type UnescoHeritageSite,
  type MarineSpeciesGuide,
} from '@/lib/visitor/guides-data'
import { getVisitorProfile, simulateGateScan, type VisitorProfile } from '@/lib/visitor/store'
import { getAllReports, type PendingReport } from '@/lib/offline/db'
import {
  Map as MapIcon,
  Compass,
  Shield,
  Landmark,
  Waves,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  QrCode,
  Star,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Filter,
  Plus,
  RefreshCw,
  LogOut,
  User,
  Info,
  Layers,
  Award,
  Navigation,
  WifiOff,
} from 'lucide-react'

interface CitizenReportItem {
  id: string
  title: string
  report_type: string
  severity: number
  status: string
  created_at: string
  description: string
  source?: 'supabase' | 'offline'
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  under_review: '#00bcd4',
  resolved: '#10b981',
  dismissed: '#6b7280',
}

const SEV_COLOR = (s: number) =>
  ['', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444'][s] || '#6b7280'

type PortalTab = 'map' | 'reports' | 'guides' | 'geofence' | 'pass'

interface CitizenPortalViewProps {
  isDashboard?: boolean
}

export default function CitizenPortalView({ isDashboard = false }: CitizenPortalViewProps) {
  const router = useRouter()
  const { isOnline, pendingCount, isSyncing, triggerSync } = useOffline()
  const [activeTab, setActiveTab] = useState<PortalTab>('map')
  const [user, setUser] = useState<{ email: string; full_name: string; role?: string } | null>(null)
  const [visitorProfile, setVisitorProfile] = useState<VisitorProfile | null>(null)
  const [reports, setReports] = useState<CitizenReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'under_review' | 'resolved'>('all')
  const [showSurvey, setShowSurvey] = useState(false)
  const [selectedGuideType, setSelectedGuideType] = useState<'heritage' | 'species'>('heritage')

  // Load user & reports
  useEffect(() => {
    async function loadPortalData() {
      const profile = getVisitorProfile()
      setVisitorProfile(profile)

      try {
        const supabase = createClient()
        const { data: { user: u } } = await supabase.auth.getUser()

        if (u) {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('full_name, email, role')
            .eq('id', u.id)
            .single()

          setUser({
            email: userProfile?.email || u.email || '',
            full_name: userProfile?.full_name || 'Citizen Steward',
            role: userProfile?.role,
          })

          // Fetch reports from Supabase
          const { data: reps } = await supabase
            .from('citizen_science_reports')
            .select('id, report_type, incident_type, species_type, severity, validation_status, created_at, description')
            .eq('reporter_id', u.id)
            .order('created_at', { ascending: false })

          const onlineReps: CitizenReportItem[] = (reps || []).map((r) => {
            const displayTitle = r.incident_type
              ? r.incident_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
              : r.species_type || (r.report_type === 'wildlife_sighting' ? 'Wildlife Sighting' : 'Incident Report')
            return {
              id: r.id,
              title: displayTitle,
              report_type: r.report_type,
              severity: r.severity || 2,
              status: r.validation_status || 'pending',
              created_at: r.created_at,
              description: r.description || '',
              source: 'supabase',
            }
          })

          // Also merge any local offline reports
          const offlineReps = await loadOfflineReports()
          setReports([...onlineReps, ...offlineReps])
        } else {
          // Guest mode: load offline / local reports
          setUser({
            email: 'citizen-guest@ndnp-mpa.gov',
            full_name: 'Guest Citizen Steward',
            role: 'citizen',
          })
          const offlineReps = await loadOfflineReports()
          setReports(offlineReps)
        }
      } catch (err) {
        console.warn('CitizenPortalView load error (offline fallback):', err)
        setUser({
          email: 'citizen-offline@ndnp-mpa.gov',
          full_name: 'Offline Citizen Steward',
          role: 'citizen',
        })
        const offlineReps = await loadOfflineReports()
        setReports(offlineReps)
      } finally {
        setLoading(false)
      }
    }

    async function loadOfflineReports(): Promise<CitizenReportItem[]> {
      try {
        const offline = await getAllReports()
        return offline.map((p) => ({
          id: p.id,
          title: (p.payload.title as string) || `${p.form_type.replace(/_/g, ' ')} Report`,
          report_type: (p.payload.report_type as string) || p.form_type,
          severity: Number(p.payload.severity) || 2,
          status: p.status === 'synced' ? 'resolved' : 'pending',
          created_at: p.created_at,
          description: (p.payload.description as string) || 'Captured locally on device',
          source: 'offline',
        }))
      } catch {
        return []
      }
    }

    loadPortalData()
  }, [])

  async function handleSignOut() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      // ignore
    }
    router.push('/')
  }

  const filteredReports = reports.filter((r) => {
    if (reportFilter === 'all') return true
    return r.status === reportFilter
  })

  return (
    <div
      style={{
        minHeight: isDashboard ? 'calc(100vh - 52px)' : '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'var(--font-jakarta)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Header */}
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '60px',
          background: 'var(--header-bg)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
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
              <Sparkles size={18} color="#ffffff" />
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>NDNP Marine Sanctuary</span>
          </Link>
          <span style={{ color: 'var(--border2)' }}>/</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 700 }}>Citizen Portal</span>
            {!isOnline ? (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(245,158,11,0.15)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245,158,11,0.4)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <WifiOff size={10} />
                OFFLINE
              </span>
            ) : (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(0,188,212,0.12)',
                  color: 'var(--teal)',
                  border: '1px solid rgba(0,188,212,0.3)',
                }}
              >
                UNLOCKED
              </span>
            )}
          </div>
        </div>

        {/* Header Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link
            href="/report"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(239,68,68,0.3)',
            }}
          >
            <Camera size={14} />
            <span>New Report</span>
          </Link>

          <button
            onClick={() => setShowSurvey(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Star size={14} color="#f59e0b" />
            <span>Exit Survey</span>
          </button>

          <PWAInstallButton />

          <ThemeToggle />

          {user && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '12px',
                color: 'var(--text-dim)',
                marginLeft: '6px',
              }}
            >
              <User size={13} color="var(--teal)" />
              <span>{user.full_name}</span>
            </div>
          )}

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            title="Sign out of account"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>

          {/* Exit Button */}
          <Link
            href="/"
            title="Exit Citizen Portal to Main Site"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '12px',
              fontWeight: 700,
              textDecoration: 'none',
              marginLeft: '2px',
              transition: 'background 0.15s ease',
            }}
          >
            <ChevronLeft size={14} />
            <span>Exit</span>
          </Link>
        </div>
      </header>

      {/* Geofence Live Alert Bar */}
      <GeofenceAlertBanner />

      {/* Tabs Navigation Bar */}
      <div
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { id: 'map', label: 'Interactive Marine & Trail Map', icon: MapIcon, badge: 'Full Access' },
            { id: 'reports', label: 'My Reports & Submissions', icon: Camera, count: reports.length },
            { id: 'guides', label: 'Heritage & Marine Guides', icon: Landmark },
            { id: 'geofence', label: 'Sanctuary Geofence & Rules', icon: Shield },
            { id: 'pass', label: 'Digital Conservation Pass', icon: QrCode },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as PortalTab)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--teal)' : '2px solid transparent',
                  color: isActive ? 'var(--teal)' : 'var(--text-dim)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 120ms',
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    style={{
                      fontSize: '10px',
                      background: 'rgba(0,188,212,0.15)',
                      color: 'var(--teal)',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontWeight: 700,
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
                {tab.count !== undefined && (
                  <span
                    style={{
                      fontSize: '11px',
                      background: 'var(--surface2)',
                      color: 'var(--text)',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontWeight: 700,
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>GPS Geofence:</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            Active
          </span>
        </div>
      </div>

      {/* Main Tab Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {/* 1. MAP TAB (UNLOCKED) */}
        {activeTab === 'map' && (
          <div style={{ flex: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', minHeight: '600px' }}>
            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '16px',
                zIndex: 1001,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '6px 12px',
                boxShadow: 'var(--card-shadow)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>Citizen Mode:</span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981' }}>Full Access Unlocked</span>
              <span style={{ color: 'var(--border2)' }}>|</span>
              <Link
                href="/report"
                style={{
                  fontSize: '11px',
                  color: 'var(--teal)',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Camera size={12} />
                <span>Log Sighting on Map</span>
              </Link>
            </div>
            <InteractiveMapLoader />
          </div>
        )}

        {/* 2. MY REPORTS & SUBMISSIONS TAB */}
        {activeTab === 'reports' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
            {/* Header + Stats */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px' }}>
                  Citizen Incident &amp; Wildlife Reports
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Review your citizen science contributions and environmental incident submissions in Nelson&apos;s Dockyard.
                </p>
              </div>

              <Link
                href="/report"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #00bcd4, #0077a8)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(0,188,212,0.3)',
                }}
              >
                <Plus size={16} />
                <span>Submit New Report</span>
              </Link>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '28px' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--card-shadow)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Total Reports</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--teal)' }}>{reports.length}</div>
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--card-shadow)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Pending Review</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>
                  {reports.filter((r) => r.status === 'pending').length}
                </div>
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--card-shadow)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Verified / Resolved</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>
                  {reports.filter((r) => r.status === 'resolved').length}
                </div>
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--card-shadow)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Steward Level</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#8b5cf6', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Award size={16} />
                  <span>Level 1 Steward</span>
                </div>
              </div>
            </div>

            {/* Filter Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Filter size={13} /> Filter:
              </span>
              {(['all', 'pending', 'under_review', 'resolved'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setReportFilter(st)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: reportFilter === st ? 'var(--teal)' : 'var(--surface)',
                    color: reportFilter === st ? '#ffffff' : 'var(--text-dim)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {st.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            {/* Reports List */}
            {filteredReports.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '60px 24px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                <div style={{ fontSize: '42px', marginBottom: '12px' }}>🌊</div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
                  No reports in this category
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Spotted an endangered sea turtle, broken coral, or illegal boat speed in the harbour? Log it now to alert park rangers.
                </p>
                <Link
                  href="/report"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #00bcd4, #0077a8)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  <Camera size={14} />
                  <span>Submit First Report</span>
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredReports.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      boxShadow: 'var(--card-shadow)',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '16px',
                      alignItems: 'start',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                          {r.title}
                        </h4>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '10px',
                            fontWeight: 800,
                            background: `${SEV_COLOR(r.severity)}18`,
                            color: SEV_COLOR(r.severity),
                            border: `1px solid ${SEV_COLOR(r.severity)}40`,
                          }}
                        >
                          Severity {r.severity}
                        </span>
                        {r.source === 'offline' && (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              background: 'rgba(245,158,11,0.12)',
                              color: '#f59e0b',
                            }}
                          >
                            Offline Saved
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', gap: '8px' }}>
                        <span>Type: <strong>{r.report_type.replace(/_/g, ' ')}</strong></span>
                        <span>•</span>
                        <span>{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>

                      <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.5, margin: 0 }}>
                        {r.description}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: `${STATUS_COLORS[r.status] || '#6b7280'}20`,
                          color: STATUS_COLORS[r.status] || '#6b7280',
                          border: `1px solid ${STATUS_COLORS[r.status] || '#6b7280'}40`,
                          textTransform: 'capitalize',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.status?.replace(/_/g, ' ') || 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. HERITAGE & MARINE GUIDES TAB */}
        {activeTab === 'guides' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px' }}>
                  Field Guides &amp; Marine Biodiversity
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Official UNESCO World Heritage archaeological landmarks and key marine indicator species in Nelson&apos;s Dockyard.
                </p>
              </div>

              {/* Selector */}
              <div style={{ display: 'flex', background: 'var(--surface2)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <button
                  onClick={() => setSelectedGuideType('heritage')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: selectedGuideType === 'heritage' ? 'var(--teal)' : 'transparent',
                    color: selectedGuideType === 'heritage' ? '#ffffff' : 'var(--text-dim)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🏛️ UNESCO Sites
                </button>
                <button
                  onClick={() => setSelectedGuideType('species')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: selectedGuideType === 'species' ? 'var(--teal)' : 'transparent',
                    color: selectedGuideType === 'species' ? '#ffffff' : 'var(--text-dim)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🐢 Marine Species
                </button>
              </div>
            </div>

            {/* Heritage Sites Section */}
            {selectedGuideType === 'heritage' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {UNESCO_HERITAGE_SITES.map((site) => (
                  <div
                    key={site.id}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '14px',
                      padding: '20px',
                      boxShadow: 'var(--card-shadow)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: `${site.color}15`,
                            color: site.color,
                            border: `1px solid ${site.color}35`,
                          }}
                        >
                          {site.badge}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{site.era}</span>
                      </div>

                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>
                        {site.title}
                      </h3>

                      <p style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: '14px' }}>
                        {site.description}
                      </p>

                      <div
                        style={{
                          fontSize: '11px',
                          background: 'var(--surface2)',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          marginBottom: '16px',
                          color: 'var(--text-dim)',
                        }}
                      >
                        <strong>UNESCO Significance:</strong> {site.unescoCriteria}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--border)', gap: '8px' }}>
                      <button
                        onClick={() => setActiveTab('map')}
                        style={{
                          fontSize: '12px',
                          color: 'var(--teal)',
                          background: 'none',
                          border: 'none',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Navigation size={13} />
                        <span>Locate on Map</span>
                      </button>

                      <Link
                        href={`/report?loc=${encodeURIComponent(site.title)}&lat=${site.coords[0]}&lng=${site.coords[1]}`}
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Camera size={13} color="var(--teal)" />
                        <span>Report Near Site</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Marine Species Section */}
            {selectedGuideType === 'species' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {CARIBBEAN_MARINE_SPECIES.map((species) => (
                  <div
                    key={species.id}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '14px',
                      padding: '20px',
                      boxShadow: 'var(--card-shadow)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ fontSize: '32px' }}>{species.icon}</div>
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                            {species.name}
                          </h3>
                          <div style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                            {species.scientificName}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            color: species.statusBadgeColor,
                            background: `${species.statusBadgeColor}15`,
                            border: `1px solid ${species.statusBadgeColor}40`,
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          {species.conservationStatus}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            color: 'var(--text-dim)',
                            background: 'var(--surface2)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {species.primaryLocation}
                        </span>
                      </div>

                      <p style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: '12px' }}>
                        {species.description}
                      </p>

                      <div
                        style={{
                          fontSize: '11px',
                          background: 'rgba(16,185,129,0.08)',
                          border: '1px solid rgba(16,185,129,0.25)',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          color: '#10b981',
                          marginBottom: '16px',
                        }}
                      >
                        <strong>Ecological Role:</strong> {species.ecologicalRole}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--border)', gap: '8px' }}>
                      <button
                        onClick={() => setActiveTab('map')}
                        style={{
                          fontSize: '12px',
                          color: '#10b981',
                          background: 'none',
                          border: 'none',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Navigation size={13} />
                        <span>Show Habitat</span>
                      </button>

                      <Link
                        href={`/report?type=wildlife&species=${encodeURIComponent(species.name)}&lat=${species.coords[0]}&lng=${species.coords[1]}`}
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Camera size={13} color="#10b981" />
                        <span>Log Sighting</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. SANCTUARY GEOFENCE & RULES TAB */}
        {activeTab === 'geofence' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px' }}>
              Sanctuary Zoning &amp; Environmental Regulations
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Nelson&apos;s Dockyard National Park enforces strict marine spatial planning bylaws to safeguard coral colonies and historic marine artefacts.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
              {/* Zone 1 */}
              <div style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '14px', padding: '20px', boxShadow: 'var(--card-shadow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>Zone 1 — Restricted Marine Sanctuary</span>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>
                  Fort Berkeley Coral Restoration Reef
                </h3>
                <ul style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.8, paddingLeft: '18px', margin: '0 0 16px' }}>
                  <li><strong>Strict No-Take Zone:</strong> All recreational and commercial fishing or conch harvesting strictly prohibited.</li>
                  <li><strong>Speed Limit:</strong> 3 Knots (Idle speed only). No wake permitted.</li>
                  <li><strong>Anchoring:</strong> Zero tolerance anchoring on reef bed. Designated moorings only.</li>
                  <li><strong>Diving:</strong> Must be accompanied by a licensed NDNP marine guide.</li>
                </ul>
                <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>Fine: Up to $5,000 XCD for violations</div>
              </div>

              {/* Zone 2 */}
              <div style={{ background: 'var(--surface)', border: '1px solid rgba(0,188,212,0.3)', borderRadius: '14px', padding: '20px', boxShadow: 'var(--card-shadow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00bcd4' }} />
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--teal)', textTransform: 'uppercase' }}>Zone 2 — Core Maritime Dockyard</span>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>
                  English Harbour Navigational Basin
                </h3>
                <ul style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.8, paddingLeft: '18px', margin: '0 0 16px' }}>
                  <li><strong>Speed Limit:</strong> 5 Knots (&ldquo;Dead Slow&rdquo;) throughout entire inner channel.</li>
                  <li><strong>Discharge:</strong> Strictly zero bilge, sewage, or holding tank discharge.</li>
                  <li><strong>Mooring:</strong> Mandatory Port Authority mooring permit.</li>
                  <li><strong>Hull Cleaning:</strong> Prohibited without containment booms in place.</li>
                </ul>
                <div style={{ fontSize: '11px', color: 'var(--teal)', fontWeight: 700 }}>VHF Monitor: Channel 16 / 68 (Harbour Control)</div>
              </div>

              {/* Zone 3 */}
              <div style={{ background: 'var(--surface)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '14px', padding: '20px', boxShadow: 'var(--card-shadow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>Zone 3 — Turtle Nursery &amp; Flats</span>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>
                  Galleon Beach &amp; Freeman&apos;s Bay
                </h3>
                <ul style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.8, paddingLeft: '18px', margin: '0 0 16px' }}>
                  <li><strong>Wildlife Distance:</strong> Keep at least 3 meters from foraging sea turtles and rays.</li>
                  <li><strong>Beach Rules:</strong> No artificial lighting after dark (May-Nov turtle nesting).</li>
                  <li><strong>Sunscreen:</strong> Mineral-based (Reef-Safe) sunscreens only.</li>
                  <li><strong>Watercraft:</strong> Motorized jet skis prohibited within 200m of shoreline.</li>
                </ul>
                <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>Protected under Endangered Species Act</div>
              </div>
            </div>
          </div>
        )}

        {/* 5. DIGITAL CONSERVATION PASS TAB */}
        {activeTab === 'pass' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px' }}>
              Digital Conservation Steward Pass
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Your electronic park credential supporting marine preservation and citizen science verification.
            </p>

            <div
              style={{
                background: 'linear-gradient(135deg, rgba(0, 188, 212, 0.12), rgba(0, 119, 168, 0.2))',
                border: '1px solid rgba(0, 188, 212, 0.35)',
                borderRadius: '16px',
                padding: '28px',
                boxShadow: 'var(--card-shadow)',
                maxWidth: '480px',
                margin: '0 auto 32px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #00bcd4, #0077a8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Sparkles size={20} color="#ffffff" />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>NDNP Citizen Pass</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>UNESCO World Heritage Site</div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    background: '#10b98120',
                    color: '#10b981',
                    border: '1px solid #10b98140',
                    padding: '3px 10px',
                    borderRadius: '20px',
                  }}
                >
                  VALID
                </span>
              </div>

              {/* QR Code representation */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '16px',
                  borderRadius: '12px',
                  width: '160px',
                  height: '160px',
                  margin: '0 auto 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              >
                <QrCode size={120} color="#0f172a" />
                <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 800, marginTop: '4px' }}>
                  PASS #NDNP-{user ? '7492' : 'GUEST'}
                </span>
              </div>

              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>
                  {user?.full_name || 'Guest Citizen Steward'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {user?.email || 'citizen-guest@ndnp-mpa.gov'}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  paddingTop: '16px',
                  borderTop: '1px solid rgba(0, 188, 212, 0.2)',
                  fontSize: '11px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Category: </span>
                  <strong style={{ color: 'var(--teal)' }}>Citizen Steward</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Park Fee: </span>
                  <strong style={{ color: '#10b981' }}>Exempt / Resident</strong>
                </div>
              </div>
            </div>

            {/* Survey Button */}
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => setShowSurvey(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                <Star size={16} color="#f59e0b" />
                <span>Complete Park Stewardship Survey</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Exit Survey Modal */}
      {showSurvey && (
        <ExitSurveyModal
          isOpen={showSurvey}
          onClose={() => setShowSurvey(false)}
        />
      )}
    </div>
  )
}
