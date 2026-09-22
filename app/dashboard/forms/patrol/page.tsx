'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormShell, FieldGroup, Field, inputStyle, selectStyle } from '@/components/forms/FormShell'
import { GPSCapture } from '@/components/forms/GPSCapture'

export default function PatrolForm() {
  const [patrolType, setPatrolType] = useState('')
  const [sector, setSector] = useState('')
  const [startLat, setStartLat] = useState(''); const [startLng, setStartLng] = useState('')
  const [endLat, setEndLat] = useState('');   const [endLng, setEndLng] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [violations, setViolations] = useState('0')
  const [warnings, setWarnings] = useState('0')
  const [fuelUsed, setFuelUsed] = useState('')
  const [vesselId, setVesselId] = useState('')
  const [incidentNotes, setIncidentNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false); const [success, setSuccess] = useState(false); const [submitError, setSubmitError] = useState<string | null>(null)

  function validate() {
    const e: Record<string, string> = {}
    if (!patrolType) e.patrolType = 'Patrol type is required'
    if (!startTime) e.startTime = 'Start time is required'
    if (!startLat || !startLng) e.startGps = 'Start GPS is required'
    if (endTime && startTime && new Date(endTime) <= new Date(startTime)) e.endTime = 'End time must be after start time'
    if (patrolType === 'boat' && !fuelUsed) e.fuelUsed = 'Fuel entry is required for boat patrols'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true); setSubmitError(null); setSuccess(false)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setSubmitError('Not logged in'); setLoading(false); return }
    const { error } = await sb.from('patrol_logs').insert({
      ranger_id: user.id,
      patrol_type: patrolType,
      sector: sector || null,
      start_lat: parseFloat(startLat), start_lng: parseFloat(startLng),
      end_lat: endLat ? parseFloat(endLat) : null,
      end_lng: endLng ? parseFloat(endLng) : null,
      start_time: startTime,
      end_time: endTime || null,
      violations: parseInt(violations) || 0,
      warnings: parseInt(warnings) || 0,
      fuel_used_l: fuelUsed ? parseFloat(fuelUsed) : null,
      vessel_id: vesselId || null,
      incident_notes: incidentNotes || null,
      is_active: !endTime,
      is_offline_sync: false,
    })
    if (error) { setSubmitError(error.message); setLoading(false); return }
    setSuccess(true); setLoading(false)
    setPatrolType(''); setSector(''); setStartLat(''); setStartLng('')
    setEndLat(''); setEndLng(''); setStartTime(''); setEndTime('')
    setViolations('0'); setWarnings('0'); setFuelUsed(''); setVesselId(''); setIncidentNotes('')
  }

  return (
    <FormShell title="Patrol Log" subtitle="Record patrol activities, GPS positions, violations issued, and fuel usage" frId="FR-FORM-04" onSubmit={onSubmit} loading={loading} success={success} error={submitError}>
      <FieldGroup title="Patrol Type & Sector">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Patrol Type" required error={errors.patrolType}>
            <select value={patrolType} onChange={e => setPatrolType(e.target.value)} style={selectStyle}>
              <option value="">Select type…</option>
              <option value="boat">Boat</option>
              <option value="foot">Foot</option>
              <option value="drone">Drone</option>
              <option value="vehicle">Vehicle</option>
            </select>
          </Field>
          <Field label="Patrol Sector / Zone">
            <input value={sector} onChange={e => setSector(e.target.value)} style={inputStyle} placeholder="e.g. North Reef, Sector B" />
          </Field>
        </div>
        {patrolType === 'boat' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Vessel ID">
              <input value={vesselId} onChange={e => setVesselId(e.target.value)} style={inputStyle} placeholder="e.g. MPA-01" />
            </Field>
            <Field label="Fuel Used (L)" required error={errors.fuelUsed}>
              <input type="number" step="0.5" min="0" value={fuelUsed} onChange={e => setFuelUsed(e.target.value)} style={inputStyle} placeholder="Litres consumed" />
            </Field>
          </div>
        )}
      </FieldGroup>

      <FieldGroup title="Patrol Times">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Start Date & Time" required error={errors.startTime}>
            <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="End Date & Time (if completed)" error={errors.endTime}>
            <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup title="Start GPS Position">
        <Field label="Start GPS" required error={errors.startGps}>
          <GPSCapture lat={startLat} lng={startLng} onCapture={(lat, lng) => { setStartLat(lat.toFixed(6)); setStartLng(lng.toFixed(6)) }} required />
        </Field>
      </FieldGroup>

      <FieldGroup title="End GPS Position (if patrol complete)">
        <Field label="End GPS">
          <GPSCapture lat={endLat} lng={endLng} onCapture={(lat, lng) => { setEndLat(lat.toFixed(6)); setEndLng(lng.toFixed(6)) }} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Enforcement">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Violations Issued" hint="Number of citation/violations">
            <input type="number" min="0" value={violations} onChange={e => setViolations(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Warnings Issued">
            <input type="number" min="0" value={warnings} onChange={e => setWarnings(e.target.value)} style={inputStyle} />
          </Field>
        </div>
        <Field label="Incident Notes">
          <textarea value={incidentNotes} onChange={e => setIncidentNotes(e.target.value)} rows={3}
            style={{...inputStyle, resize: 'vertical'}} placeholder="Describe any violations, suspicious activity, incidents encountered…" />
        </Field>
      </FieldGroup>
    </FormShell>
  )
}

