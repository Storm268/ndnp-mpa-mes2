'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormShell, FieldGroup, Field, inputStyle, selectStyle } from '@/components/forms/FormShell'
import { GPSCapture } from '@/components/forms/GPSCapture'
import { audit } from '@/lib/audit/log-action'

const INCIDENT_TYPES = [
  'Illegal fishing / poaching','Coral damage / anchor strike','Oil / fuel spill',
  'Plastic / litter pollution','Chemical discharge / effluent','Mangrove damage',
  'Vessel grounding','Dredging / construction damage','Invasive species spotted',
  'Mass mortality event','Algal bloom','Sewage discharge','Other',
]

const SEV_LABELS = ['Minor','Low','Moderate','High','Critical']
const SEV_COLORS = ['#22c55e','#84cc16','#f59e0b','#f97316','#ef4444']

export default function IncidentForm() {
  const [incidentType, setIncidentType] = useState('')
  const [severity, setSeverity] = useState(0)
  const [description, setDescription] = useState('')
  const [gpsLat, setGpsLat] = useState(''); const [gpsLng, setGpsLng] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false); const [success, setSuccess] = useState(false); const [submitError, setSubmitError] = useState<string | null>(null)
  const [alertSent, setAlertSent] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!incidentType) e.incidentType = 'Incident type is required'
    if (severity === 0) e.severity = 'Severity level is required'
    if (!gpsLat || !gpsLng) e.gps = 'GPS coordinates are required'
    if (severity >= 3 && !description) e.description = 'Description is required for severity 3 or above'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true); setSubmitError(null); setSuccess(false); setAlertSent(false)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const latNum = parseFloat(gpsLat)
    const lngNum = parseFloat(gpsLng)
    const { data: inserted, error } = await sb
      .from('citizen_science_reports')
      .insert({
        reporter_id: user?.id ?? null,
        report_type: 'environmental_incident',
        incident_type: incidentType,
        severity,
        description: description || null,
        gps_lat: latNum,
        gps_lng: lngNum,
        validation_status: 'pending',
        is_offline_sync: false,
      })
      .select('id')
      .single()

    if (error) { setSubmitError(error.message); setLoading(false); return }

    const wasHighSeverity = severity >= 4
    // Dispatch alert for ALL environmental incident types (severity 4-5 as urgent severity_high, 1-3 as patrol_incident)
    try {
      const alertRes = await fetch('/api/alerts/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_type: wasHighSeverity ? 'severity_high' : 'patrol_incident',
          title: wasHighSeverity
            ? `High-Severity Incident: ${incidentType}`
            : `Incident Reported: ${incidentType}`,
          message: wasHighSeverity
            ? `A severity ${severity} ${incidentType} incident has been reported at GPS ${gpsLat}, ${gpsLng}. Immediate attention required.`
            : `A severity ${severity} ${incidentType} incident has been reported at GPS ${gpsLat}, ${gpsLng}.`,
          severity,
          incident_type: incidentType,
          gps_lat: latNum,
          gps_lng: lngNum,
          related_record_id: inserted?.id ?? null,
          related_table: 'citizen_science_reports',
        }),
      })
      if (alertRes.ok) {
        setAlertSent(true)
      }
    } catch { /* non-blocking alert */ }

    await audit.formSubmit('citizen_science_reports', inserted?.id ?? '', `Environmental Incident (${incidentType})`)
    setSuccess(true); setLoading(false)
    setIncidentType(''); setSeverity(0); setDescription(''); setGpsLat(''); setGpsLng('')
  }

  return (
    <FormShell title="Environmental Incident" subtitle="Report an environmental incident or threat. Alerts notify park operations across all incident types (Severity 4-5 marked urgent)." frId="FR-FORM-08" onSubmit={onSubmit} loading={loading} success={success} error={submitError} submitLabel="Report Incident">
      {/* High severity warning */}
      {severity >= 4 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/></svg>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ef4444', marginBottom: '1px' }}>High-Severity Incident</div>
            <div style={{ fontSize: '0.72rem', color: '#fca5a5' }}>Submitting this report will automatically send a high-priority alert to the duty park manager for immediate response.</div>
          </div>
        </div>
      )}

      {alertSent && success && (
        <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.78rem', color: '#fed7aa' }}>
          Incident alert dispatched to park operations &amp; duty manager.
        </div>
      )}

      <FieldGroup title="Incident Details">
        <Field label="Incident Type" required error={errors.incidentType}>
          <select value={incidentType} onChange={e => setIncidentType(e.target.value)} style={selectStyle}>
            <option value="">Select incident type…</option>
            {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>

        <Field label="Severity Level" required error={errors.severity}>
          <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button" onClick={() => setSeverity(n)}
                style={{ flex: 1, padding: '10px 4px', border: `2px solid ${n === severity ? SEV_COLORS[n-1] : 'var(--border)'}`, borderRadius: '8px', background: n === severity ? `${SEV_COLORS[n-1]}18` : 'var(--surface)', cursor: 'pointer', transition: 'all 150ms', textAlign: 'center' }}
              >
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: n === severity ? SEV_COLORS[n-1] : 'var(--text-muted)' }}>{n}</div>
                <div style={{ fontSize: '0.52rem', fontWeight: 700, color: n === severity ? SEV_COLORS[n-1] : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '1px' }}>{SEV_LABELS[n-1]}</div>
              </button>
            ))}
          </div>
          {severity > 0 && (
            <div style={{ marginTop: '8px', fontSize: '0.72rem', color: SEV_COLORS[severity-1] }}>
              {severity <= 2 && 'Severity 1-2: Document for records. Routine monitoring.'}
              {severity === 3 && 'Severity 3: Moderate concern. Description and photo required.'}
              {severity >= 4 && 'Severity 4-5: Critical. Immediate alert to duty manager upon submission.'}
            </div>
          )}
        </Field>
      </FieldGroup>

      <FieldGroup title="Location">
        <Field label="GPS Coordinates" required error={errors.gps}>
          <GPSCapture lat={gpsLat} lng={gpsLng} onCapture={(lat, lng) => { setGpsLat(lat.toFixed(6)); setGpsLng(lng.toFixed(6)) }} required />
        </Field>
      </FieldGroup>

      <FieldGroup title="Description">
        <Field label="Incident Description" required={severity >= 3} error={errors.description}
          hint={severity >= 3 ? 'Required for severity 3 or above. Include extent, duration, affected area.' : undefined}>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
            style={{...inputStyle, resize: 'vertical', borderColor: errors.description ? 'rgba(239,68,68,0.5)' : undefined}}
            placeholder="Describe the incident: what you observed, estimated extent, any immediate threats to wildlife or habitat…" />
        </Field>
      </FieldGroup>
    </FormShell>
  )
}


