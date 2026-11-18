'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Camera,
  Save,
  RotateCcw,
  X,
  ExternalLink,
  Loader2,
  SlidersHorizontal,
  WifiOff,
  FileText,
  AlertTriangle,
} from 'lucide-react'

export interface PatrolLogItem {
  id: string
  ranger_id: string | null
  patrol_type: string
  sector: string | null
  start_lat?: number | null
  start_lng?: number | null
  start_time: string
  end_time?: string | null
  violations: number | null
  warnings: number | null
  fuel_used_l?: number | null
  vessel_id?: string | null
  profiles: { full_name: string | null } | null
}

export interface CSIncidentItem {
  id: string
  reporter_id: string | null
  report_type: string
  severity: number | null
  incident_type: string | null
  description: string | null
  photo_urls: string[] | null
  gps_lat: number | null
  gps_lng: number | null
  validation_status: 'pending' | 'approved' | 'rejected' | string
  validator_id: string | null
  validator_notes: string | null
  validated_at: string | null
  is_offline_sync: boolean | null
  created_at: string
}

interface PatrolDashboardClientProps {
  activePatrols: PatrolLogItem[]
  recentPatrols: PatrolLogItem[]
  initialIncidents: CSIncidentItem[]
  canReview: boolean
}

const INCIDENT_TYPES = [
  { value: 'coral_damage', label: 'Coral Damage' },
  { value: 'illegal_fishing', label: 'Illegal Fishing' },
  { value: 'pollution', label: 'Pollution / Dumping' },
  { value: 'wildlife_disturbance', label: 'Wildlife Disturbance' },
  { value: 'vessel_violation', label: 'Vessel Violation' },
  { value: 'other', label: 'Other Threat' },
]

const SEVERITY_LABELS: Record<number, string> = {
  1: '1 — Low',
  2: '2 — Moderate',
  3: '3 — Significant',
  4: '4 — High',
  5: '5 — Critical',
}

function severityColor(s: number): string {
  if (s >= 4) return '#ef4444'
  if (s === 3) return '#f59e0b'
  return '#22c55e'
}

function statusMeta(status: string): { label: string; color: string; bg: string; border: string } {
  if (status === 'approved') {
    return {
      label: 'Accepted',
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.3)',
    }
  }
  if (status === 'rejected') {
    return {
      label: 'Rejected',
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.3)',
    }
  }
  return {
    label: 'Pending',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.3)',
  }
}

function formatIncidentType(val: string | null): string {
  if (!val) return 'Environmental Incident'
  const match = INCIDENT_TYPES.find((t) => t.value === val)
  if (match) return match.label
  return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function PatrolTypeBadge({ type }: { type: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    boat: { color: '#4fb3e8', bg: 'rgba(79,179,232,0.12)' },
    foot: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    drone: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
    vehicle: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  }
  const s = map[type] ?? { color: 'var(--text-muted)', bg: 'var(--surface2)' }
  return (
    <span
      style={{
        fontSize: '0.65rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '2px 8px',
        borderRadius: '3px',
        color: s.color,
        background: s.bg,
      }}
    >
      {type}
    </span>
  )
}

function Duration({ start, end }: { start: string; end?: string | null }) {
  const startMs = new Date(start).getTime()
  const endMs = end ? new Date(end).getTime() : Date.now()
  const mins = Math.max(0, Math.floor((endMs - startMs) / 60000))
  if (mins < 60) return <span>{mins}m</span>
  return (
    <span>
      {Math.floor(mins / 60)}h {mins % 60}m
    </span>
  )
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

export default function PatrolDashboardClient({
  activePatrols,
  recentPatrols,
  initialIncidents,
  canReview,
}: PatrolDashboardClientProps) {
  const router = useRouter()
  const [incidents, setIncidents] = useState<CSIncidentItem[]>(initialIncidents)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selected, setSelected] = useState<CSIncidentItem | null>(null)
  const [quickActingId, setQuickActingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Modal form state
  const [editType, setEditType] = useState('')
  const [editSeverity, setEditSeverity] = useState<number>(3)
  const [editDescription, setEditDescription] = useState('')
  const [editLat, setEditLat] = useState('')
  const [editLng, setEditLng] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [savingAction, setSavingAction] = useState<'save' | 'approved' | 'rejected' | 'pending' | 'escalate' | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)

  // Sync incoming props if server refreshes
  useEffect(() => {
    setIncidents(initialIncidents)
  }, [initialIncidents])

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // Realtime subscription to citizen_science_reports
  useEffect(() => {
    const sb = createClient()
    const channel = sb
      .channel('patrol-cs-incidents')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'citizen_science_reports' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as CSIncidentItem
            if (row.report_type !== 'environmental_incident') return
            setIncidents((prev) => (prev.some((x) => x.id === row.id) ? prev : [row, ...prev]))
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as CSIncidentItem
            if (row.report_type !== 'environmental_incident') return
            setIncidents((prev) => prev.map((x) => (x.id === row.id ? row : x)))
            setSelected((curr) => (curr && curr.id === row.id ? row : curr))
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id
            if (oldId) {
              setIncidents((prev) => prev.filter((x) => x.id !== oldId))
            }
          }
        }
      )
      .subscribe()

    return () => {
      sb.removeChannel(channel)
    }
  }, [])

  // Open modal & populate form state
  const openReport = useCallback((item: CSIncidentItem) => {
    setSelected(item)
    setEditType(item.incident_type || 'other')
    setEditSeverity(typeof item.severity === 'number' ? item.severity : 3)
    setEditDescription(item.description || '')
    setEditLat(typeof item.gps_lat === 'number' ? String(item.gps_lat) : '')
    setEditLng(typeof item.gps_lng === 'number' ? String(item.gps_lng) : '')
    setEditNotes(item.validator_notes || '')
    setModalError(null)
  }, [])

  // Close modal on Escape
  useEffect(() => {
    if (!selected) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !savingAction) setSelected(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected, savingAction])

  // Persist update / decision
  async function submitUpdate(
    reportId: string,
    body: Record<string, unknown>,
    actionMode: 'save' | 'approved' | 'rejected' | 'pending' | 'escalate'
  ) {
    setSavingAction(actionMode)
    setModalError(null)
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.report) {
        const msg = json.error || 'Failed to update report.'
        setModalError(msg)
        showToast(msg, 'error')
        setSavingAction(null)
        return
      }

      const updated = json.report as CSIncidentItem
      setIncidents((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setSelected(updated)
      if (typeof updated.severity === 'number') {
        setEditSeverity(updated.severity)
      }

      const labelMap = {
        save: 'Incident report details updated.',
        approved: 'Incident report accepted & verified.',
        rejected: 'Incident report rejected.',
        pending: 'Incident report reopened to pending.',
        escalate: 'Incident escalated with high-severity alert dispatched.',
      }
      showToast(labelMap[actionMode], 'success')
      router.refresh()

      if (actionMode === 'approved' || actionMode === 'rejected') {
        setSelected(null)
      }
    } catch {
      setModalError('Network error while saving changes.')
      showToast('Network error while saving changes.', 'error')
    } finally {
      setSavingAction(null)
    }
  }

  // Quick inline accept/reject on card
  async function handleQuickDecision(
    e: React.MouseEvent,
    item: CSIncidentItem,
    decision: 'approved' | 'rejected'
  ) {
    e.stopPropagation()
    if (!canReview) return
    setQuickActingId(item.id)
    try {
      const res = await fetch(`/api/reports/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validation_status: decision }),
      })
      const json = await res.json()
      if (!res.ok || !json.report) {
        showToast(json.error || 'Failed to update report status.', 'error')
        setQuickActingId(null)
        return
      }
      const updated = json.report as CSIncidentItem
      setIncidents((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      showToast(
        decision === 'approved' ? 'Incident report accepted.' : 'Incident report rejected.',
        'success'
      )
      router.refresh()
    } catch {
      showToast('Network error while updating report.', 'error')
    } finally {
      setQuickActingId(null)
    }
  }

  function handleModalAction(mode: 'save' | 'approved' | 'rejected' | 'pending' | 'escalate') {
    if (!selected) return
    if (!editDescription.trim()) {
      setModalError('Description cannot be empty.')
      return
    }
    const lat = editLat.trim() !== '' ? Number(editLat) : null
    const lng = editLng.trim() !== '' ? Number(editLng) : null
    if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) {
      setModalError('Latitude must be a valid number between -90 and 90.')
      return
    }
    if (lng !== null && (isNaN(lng) || lng < -180 || lng > 180)) {
      setModalError('Longitude must be a valid number between -180 and 180.')
      return
    }

    const payload: Record<string, unknown> = {
      incident_type: editType,
      severity: mode === 'escalate' ? Math.max(4, editSeverity) : editSeverity,
      description: editDescription.trim(),
      validator_notes: editNotes.trim() || null,
    }
    if (lat !== null) payload.gps_lat = lat
    if (lng !== null) payload.gps_lng = lng
    if (mode === 'escalate') {
      payload.escalate = true
    } else if (mode !== 'save') {
      payload.validation_status = mode
    }

    submitUpdate(selected.id, payload, mode)
  }

  const totalViolationsToday = recentPatrols.reduce(
    (a, p) => a + (typeof p.violations === 'number' ? p.violations : 0),
    0
  )
  const totalWarningsToday = recentPatrols.reduce(
    (a, p) => a + (typeof p.warnings === 'number' ? p.warnings : 0),
    0
  )
  const highSeverityCount = incidents.filter(
    (r) =>
      r.validation_status !== 'rejected' &&
      typeof r.severity === 'number' &&
      r.severity >= 4
  ).length
  const pendingCount = incidents.filter((r) => r.validation_status === 'pending').length
  const approvedCount = incidents.filter((r) => r.validation_status === 'approved').length
  const rejectedCount = incidents.filter((r) => r.validation_status === 'rejected').length

  const filteredIncidents = incidents.filter((r) => {
    if (statusFilter === 'all') return true
    return r.validation_status === statusFilter
  })

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    color: 'var(--text)',
    fontSize: '0.82rem',
    fontFamily: 'inherit',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: '6px',
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            Patrol Operations &amp; Incidents
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            FR-DASH-03 · Active patrol map, vessel observations, citizen incident review
          </p>
        </div>

        {toast && (
          <div
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: toast.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
              color: toast.type === 'success' ? '#22c55e' : '#ef4444',
            }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            <span>{toast.text}</span>
          </div>
        )}
      </div>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {[
          { val: activePatrols.length, label: 'Active Patrols', color: '#4fb3e8', sub: 'Field units now' },
          { val: totalViolationsToday, label: 'Violations (Recent)', color: '#ef4444', sub: 'Completed patrols' },
          { val: totalWarningsToday, label: 'Warnings Issued', color: '#f59e0b', sub: 'Completed patrols' },
          { val: highSeverityCount, label: 'High-Severity CS', color: highSeverityCount > 0 ? '#ef4444' : '#22c55e', sub: 'Active Sev 4-5 incidents' },
          { val: pendingCount, label: 'CS Incidents', color: pendingCount > 0 ? '#f59e0b' : '#8b5cf6', sub: 'Pending review' },
        ].map((m) => (
          <div key={m.label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: m.color, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: '5px' }}>
              {m.val}
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{m.label}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Active patrols */}
      <h2
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        Active Patrols
        {activePatrols.length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem', fontWeight: 700, color: 'var(--teal)' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--teal)',
                display: 'inline-block',
                animation: 'livePulse 2s ease-in-out infinite',
              }}
            />
            Live
          </span>
        )}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px', marginBottom: '24px' }}>
        {activePatrols.length === 0 ? (
          <div className="card" style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            No active patrols right now. Rangers submit FR-FORM-04 to start a patrol.
          </div>
        ) : (
          activePatrols.map((p) => (
            <div key={p.id} className="card" style={{ padding: '14px 16px', borderLeft: '3px solid #4fb3e8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
                    {p.profiles?.full_name ?? 'Ranger'}
                  </div>
                  {p.sector && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sector: {p.sector}</div>}
                </div>
                <PatrolTypeBadge type={p.patrol_type} />
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                <span>
                  Duration:{' '}
                  <b style={{ color: 'var(--text)' }}>
                    <Duration start={p.start_time} />
                  </b>
                </span>
                {typeof p.violations === 'number' && p.violations > 0 && (
                  <span>
                    Violations: <b style={{ color: '#ef4444' }}>{p.violations}</b>
                  </span>
                )}
              </div>
              {p.vessel_id && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>Vessel: {p.vessel_id}</div>}
            </div>
          ))
        )}
      </div>

      {/* Recent completed patrols */}
      <h2 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
        Recent Completed Patrols
      </h2>
      <div className="card" style={{ overflow: 'hidden', marginBottom: '28px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Ranger', 'Type', 'Sector', 'Duration', 'Violations', 'Warnings', 'Fuel (L)'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentPatrols.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '16px 14px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  No completed patrols yet.
                </td>
              </tr>
            ) : (
              recentPatrols.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 500 }}>{p.profiles?.full_name ?? 'Ranger'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <PatrolTypeBadge type={p.patrol_type} />
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{p.sector || '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text)' }}>
                    {p.start_time && p.end_time ? <Duration start={p.start_time} end={p.end_time} /> : '—'}
                  </td>
                  <td
                    style={{
                      padding: '10px 14px',
                      color: typeof p.violations === 'number' && p.violations > 0 ? '#ef4444' : 'var(--text)',
                      fontWeight: typeof p.violations === 'number' && p.violations > 0 ? 700 : 400,
                    }}
                  >
                    {typeof p.violations === 'number' ? p.violations : 0}
                  </td>
                  <td style={{ padding: '10px 14px', color: typeof p.warnings === 'number' && p.warnings > 0 ? '#f59e0b' : 'var(--text)' }}>
                    {typeof p.warnings === 'number' ? p.warnings : 0}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                    {typeof p.fuel_used_l === 'number' ? p.fuel_used_l.toFixed(1) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Citizen Science Incidents Header & Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
            Environmental Incidents (Citizen Science)
          </h2>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem', fontWeight: 700, color: 'var(--teal)' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--teal)',
                display: 'inline-block',
                animation: 'livePulse 2s ease-in-out infinite',
              }}
            />
            Live
          </span>
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {(
            [
              { id: 'all', label: 'All', count: incidents.length, color: 'var(--text-dim)' },
              { id: 'pending', label: 'Pending', count: pendingCount, color: '#f59e0b' },
              { id: 'approved', label: 'Accepted', count: approvedCount, color: '#22c55e' },
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
                  padding: '5px 11px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: active ? `1px solid ${tab.color}` : '1px solid var(--border)',
                  background: active ? 'var(--surface2)' : 'transparent',
                  color: active ? tab.color : 'var(--text-muted)',
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '99px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Citizen Science Incidents List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredIncidents.length === 0 ? (
          <div className="card" style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            {incidents.length === 0
              ? 'No citizen science incidents reported yet.'
              : `No ${statusFilter} environmental incident reports.`}
          </div>
        ) : (
          filteredIncidents.map((r) => {
            const sev = typeof r.severity === 'number' ? r.severity : 0
            const col = severityColor(sev)
            const sm = statusMeta(r.validation_status)
            const date = r.created_at
              ? new Date(r.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''
            const photoCount = Array.isArray(r.photo_urls) ? r.photo_urls.length : 0
            const isBusy = quickActingId === r.id

            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => openReport(r)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openReport(r)
                  }
                }}
                className="card"
                style={{
                  padding: '13px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  borderLeft: `3px solid ${col}`,
                  cursor: 'pointer',
                  transition: 'transform 120ms ease, border-color 150ms ease',
                }}
              >
                <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '40px' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: col, lineHeight: 1 }}>{sev || '—'}</div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Severity
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
                      {formatIncidentType(r.incident_type)}
                    </span>
                    <span
                      style={{
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        background: sm.bg,
                        border: `1px solid ${sm.border}`,
                        color: sm.color,
                      }}
                    >
                      {sm.label}
                    </span>
                    {r.is_offline_sync && (
                      <span
                        style={{
                          fontSize: '0.58rem',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <WifiOff size={10} /> Synced
                      </span>
                    )}
                  </div>

                  {r.description && (
                    <div
                      style={{
                        fontSize: '0.76rem',
                        color: 'var(--text-dim)',
                        marginBottom: '5px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.description}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={11} />
                      {typeof r.gps_lat === 'number' ? r.gps_lat.toFixed(4) : '?'},{' '}
                      {typeof r.gps_lng === 'number' ? r.gps_lng.toFixed(4) : '?'}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} /> {date}
                    </span>
                    {photoCount > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--teal)' }}>
                        <Camera size={11} /> {photoCount} photo{photoCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {r.validator_notes && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#4fb3e8' }}>
                        <FileText size={11} /> Notes added
                      </span>
                    )}
                  </div>
                </div>

                {/* Right-side Quick Actions + Open button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {canReview && r.validation_status === 'pending' && (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={(e) => handleQuickDecision(e, r, 'approved')}
                        title="Accept report"
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(34,197,94,0.35)',
                          background: 'rgba(34,197,94,0.1)',
                          color: '#22c55e',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          cursor: isBusy ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontFamily: 'inherit',
                        }}
                      >
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={(e) => handleQuickDecision(e, r, 'rejected')}
                        title="Reject report"
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(239,68,68,0.35)',
                          background: 'rgba(239,68,68,0.1)',
                          color: '#ef4444',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          cursor: isBusy ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontFamily: 'inherit',
                        }}
                      >
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openReport(r)
                    }}
                    style={{
                      padding: '6px 11px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface2)',
                      color: 'var(--text)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontFamily: 'inherit',
                    }}
                  >
                    <SlidersHorizontal size={12} />
                    Open
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Incident Detail / Update / Accept / Reject Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!savingAction) setSelected(null)
            }}
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
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.16 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '680px',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
                display: 'flex',
                flexDirection: 'column',
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
                  position: 'sticky',
                  top: 0,
                  background: 'var(--surface)',
                  zIndex: 2,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                      Citizen Incident Review
                    </h3>
                    <span
                      style={{
                        fontSize: '0.64rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '99px',
                        background: statusMeta(selected.validation_status).bg,
                        border: `1px solid ${statusMeta(selected.validation_status).border}`,
                        color: statusMeta(selected.validation_status).color,
                      }}
                    >
                      {statusMeta(selected.validation_status).label}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Submitted {new Date(selected.created_at).toLocaleString('en-GB')} · ID: {selected.id.slice(0, 8)}
                    {selected.validated_at && (
                      <> · Reviewed {new Date(selected.validated_at).toLocaleString('en-GB')}</>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(savingAction)}
                  onClick={() => setSelected(null)}
                  aria-label="Close modal"
                  style={{
                    padding: '6px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {modalError && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#f87171',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    {modalError}
                  </div>
                )}

                {/* Incident Type & Severity */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={labelStyle}>Incident Type</label>
                    <select
                      disabled={!canReview || Boolean(savingAction)}
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      style={inputStyle}
                    >
                      {INCIDENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                      {!INCIDENT_TYPES.some((t) => t.value === editType) && editType && (
                        <option value={editType}>{formatIncidentType(editType)}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Severity ({SEVERITY_LABELS[editSeverity] || editSeverity})</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[1, 2, 3, 4, 5].map((lvl) => {
                        const active = editSeverity === lvl
                        const col = severityColor(lvl)
                        return (
                          <button
                            key={lvl}
                            type="button"
                            disabled={!canReview || Boolean(savingAction)}
                            onClick={() => setEditSeverity(lvl)}
                            style={{
                              flex: 1,
                              padding: '8px 0',
                              borderRadius: '7px',
                              border: active ? `1px solid ${col}` : '1px solid var(--border)',
                              background: active ? `${col}22` : 'var(--surface2)',
                              color: active ? col : 'var(--text-muted)',
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              cursor: canReview ? 'pointer' : 'default',
                              fontFamily: 'inherit',
                            }}
                          >
                            {lvl}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Full Description */}
                <div>
                  <label style={labelStyle}>Report Description &amp; Citizen Details</label>
                  <textarea
                    rows={5}
                    disabled={!canReview || Boolean(savingAction)}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
                  />
                </div>

                {/* GPS Coordinates */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>GPS Coordinates</label>
                    {editLat && editLng && !isNaN(Number(editLat)) && !isNaN(Number(editLng)) && (
                      <a
                        href={`https://www.google.com/maps?q=${Number(editLat)},${Number(editLng)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: 'var(--teal-light)',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        Open in Maps <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <input
                      type="number"
                      step="any"
                      disabled={!canReview || Boolean(savingAction)}
                      value={editLat}
                      onChange={(e) => setEditLat(e.target.value)}
                      placeholder="Latitude"
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      step="any"
                      disabled={!canReview || Boolean(savingAction)}
                      value={editLng}
                      onChange={(e) => setEditLng(e.target.value)}
                      placeholder="Longitude"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Photos if present */}
                {Array.isArray(selected.photo_urls) && selected.photo_urls.length > 0 && (
                  <div>
                    <label style={labelStyle}>Submitted Evidence Photos ({selected.photo_urls.length})</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
                      {selected.photo_urls.map((url, idx) => (
                        <a
                          key={`${url}-${idx}`}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'block',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid var(--border)',
                            aspectRatio: '4 / 3',
                            background: 'var(--surface2)',
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Incident evidence ${idx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reviewer Notes */}
                <div>
                  <label style={labelStyle}>Ranger / Manager Review Notes</label>
                  <textarea
                    rows={3}
                    disabled={!canReview || Boolean(savingAction)}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add patrol verification notes, dispatch action taken, or reason for accepting/rejecting..."
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '14px 22px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap',
                  background: 'var(--surface2)',
                  borderBottomLeftRadius: '14px',
                  borderBottomRightRadius: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {canReview && selected.validation_status !== 'pending' && (
                    <button
                      type="button"
                      disabled={Boolean(savingAction)}
                      onClick={() => handleModalAction('pending')}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text-dim)',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: savingAction ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontFamily: 'inherit',
                      }}
                    >
                      {savingAction === 'pending' ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                      Reset to Pending
                    </button>
                  )}
                </div>

                {canReview ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={Boolean(savingAction)}
                      onClick={() => handleModalAction('save')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: savingAction ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontFamily: 'inherit',
                      }}
                    >
                      {savingAction === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Update Report
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(savingAction)}
                      onClick={() => handleModalAction('escalate')}
                      title="Raise severity to High (4-5) and dispatch urgent alert to Park Managers"
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(249,115,22,0.45)',
                        background: 'rgba(249,115,22,0.12)',
                        color: '#f97316',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: savingAction ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontFamily: 'inherit',
                      }}
                    >
                      {savingAction === 'escalate' ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                      Escalate
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(savingAction)}
                      onClick={() => handleModalAction('rejected')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(239,68,68,0.4)',
                        background: 'rgba(239,68,68,0.12)',
                        color: '#ef4444',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: savingAction ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontFamily: 'inherit',
                      }}
                    >
                      {savingAction === 'rejected' ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                      Reject
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(savingAction)}
                      onClick={() => handleModalAction('approved')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#16a34a',
                        color: '#ffffff',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: savingAction ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontFamily: 'inherit',
                      }}
                    >
                      {savingAction === 'approved' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Accept Report
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Close
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
