'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormShell, FieldGroup, Field, inputStyle, selectStyle } from '@/components/forms/FormShell'
import { GPSCapture } from '@/components/forms/GPSCapture'

export default function WaterQualityForm() {
  const [stations, setStations] = useState<{id: string; station_code: string; name: string}[]>([])
  const [stationId, setStationId] = useState('')
  const [ph, setPh] = useState(''); const [doMgl, setDoMgl] = useState('')
  const [tempC, setTempC] = useState(''); const [salinityPpt, setSalinityPpt] = useState('')
  const [turbidityNtu, setTurbidityNtu] = useState('')
  const [sampleBottleId, setSampleBottleId] = useState('')
  const [chainOfCustody, setChainOfCustody] = useState('')
  const [complianceStatus, setComplianceStatus] = useState('')
  const [gpsLat, setGpsLat] = useState(''); const [gpsLng, setGpsLng] = useState('')
  const [sampledAt, setSampledAt] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false); const [success, setSuccess] = useState(false); const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    createClient().from('monitoring_stations').select('id, station_code, name').in('station_type', ['water_quality','multi']).eq('is_active', true).order('station_code')
      .then(({ data }) => setStations(data ?? []))
  }, [])

  // Auto-derive compliance status from parameters
  function deriveCompliance(phV: string, doV: string, tempV: string): string {
    const p = parseFloat(phV); const d = parseFloat(doV); const t = parseFloat(tempV)
    if ((phV && (p < 7.8 || p > 8.4)) || (doV && d < 4) || (tempV && t > 32)) return 'fail'
    if ((phV && (p < 7.9 || p > 8.3)) || (doV && d < 5) || (tempV && t > 30)) return 'warning'
    if (phV || doV || tempV) return 'pass'
    return ''
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!stationId) e.stationId = 'Station is required'
    if (ph && (parseFloat(ph) < 0 || parseFloat(ph) > 14)) e.ph = 'pH must be 0-14'
    if (doMgl && (parseFloat(doMgl) < 0 || parseFloat(doMgl) > 20)) e.doMgl = 'DO must be 0-20 mg/L'
    if (tempC && (parseFloat(tempC) < -5 || parseFloat(tempC) > 50)) e.tempC = 'Temperature must be -5 to 50°C'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true); setSubmitError(null); setSuccess(false)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setSubmitError('Not logged in'); setLoading(false); return }
    const compliance = complianceStatus || deriveCompliance(ph, doMgl, tempC) || null
    const { error } = await sb.from('water_quality').insert({
      station_id: stationId, collector_id: user.id,
      ph: ph ? parseFloat(ph) : null,
      do_mgl: doMgl ? parseFloat(doMgl) : null,
      temperature_c: tempC ? parseFloat(tempC) : null,
      salinity_ppt: salinityPpt ? parseFloat(salinityPpt) : null,
      turbidity_ntu: turbidityNtu ? parseFloat(turbidityNtu) : null,
      sample_bottle_id: sampleBottleId || null,
      chain_of_custody: chainOfCustody || null,
      compliance_status: compliance,
      gps_lat: gpsLat ? parseFloat(gpsLat) : null,
      gps_lng: gpsLng ? parseFloat(gpsLng) : null,
      sampled_at: sampledAt || new Date().toISOString(),
      is_offline_sync: false,
    })
    if (error) { setSubmitError(error.message); setLoading(false); return }
    setSuccess(true); setLoading(false)
    setStationId(''); setPh(''); setDoMgl(''); setTempC(''); setSalinityPpt('')
    setTurbidityNtu(''); setSampleBottleId(''); setChainOfCustody(''); setComplianceStatus(''); setGpsLat(''); setGpsLng('')
  }

  const autoCompliance = deriveCompliance(ph, doMgl, tempC)
  const complianceColor = { pass: '#22c55e', warning: '#f59e0b', fail: '#ef4444', '': 'var(--text-muted)' }[autoCompliance]

  return (
    <FormShell title="Water Quality" subtitle="Record in-situ parameters, sample identifiers, and chain of custody for water quality stations" frId="FR-FORM-05" onSubmit={onSubmit} loading={loading} success={success} error={submitError}>
      <FieldGroup title="Station & Sampling Info">
        <Field label="Monitoring Station" required error={errors.stationId}>
          <select value={stationId} onChange={e => setStationId(e.target.value)} style={selectStyle}>
            <option value="">Select station…</option>
            {stations.map(s => <option key={s.id} value={s.id}>{s.station_code} — {s.name}</option>)}
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Sample Bottle ID">
            <input value={sampleBottleId} onChange={e => setSampleBottleId(e.target.value)} style={inputStyle} placeholder="e.g. WQ-2024-001" />
          </Field>
          <Field label="Sampled At">
            <input type="datetime-local" value={sampledAt} onChange={e => setSampledAt(e.target.value)} style={inputStyle} />
          </Field>
        </div>
        <Field label="GPS Coordinates">
          <GPSCapture lat={gpsLat} lng={gpsLng} onCapture={(lat, lng) => { setGpsLat(lat.toFixed(6)); setGpsLng(lng.toFixed(6)) }} />
        </Field>
      </FieldGroup>

      <FieldGroup title="In-Situ Parameters">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <Field label="pH (0–14)" error={errors.ph} hint="Acceptable: 7.8–8.4">
            <input type="number" step="0.01" min="0" max="14" value={ph} onChange={e => setPh(e.target.value)} style={inputStyle} placeholder="e.g. 8.1" />
          </Field>
          <Field label="DO (mg/L)" error={errors.doMgl} hint="Acceptable: ≥5 mg/L">
            <input type="number" step="0.1" min="0" max="20" value={doMgl} onChange={e => setDoMgl(e.target.value)} style={inputStyle} placeholder="e.g. 6.8" />
          </Field>
          <Field label="Temperature (°C)" error={errors.tempC} hint="Alert if &gt;30°C">
            <input type="number" step="0.1" min="-5" max="50" value={tempC} onChange={e => setTempC(e.target.value)} style={inputStyle} placeholder="e.g. 27.5" />
          </Field>
          <Field label="Salinity (ppt)">
            <input type="number" step="0.1" value={salinityPpt} onChange={e => setSalinityPpt(e.target.value)} style={inputStyle} placeholder="e.g. 35.0" />
          </Field>
          <Field label="Turbidity (NTU)">
            <input type="number" step="0.1" value={turbidityNtu} onChange={e => setTurbidityNtu(e.target.value)} style={inputStyle} placeholder="e.g. 2.5" />
          </Field>
          <Field label="Compliance Status">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '38px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: complianceColor, flexShrink: 0 }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: complianceColor, textTransform: 'capitalize' }}>
                {autoCompliance || 'Enter parameters above'}
              </span>
            </div>
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup title="Chain of Custody">
        <Field label="Chain of Custody Notes">
          <textarea value={chainOfCustody} onChange={e => setChainOfCustody(e.target.value)} rows={3}
            style={{...inputStyle, resize: 'vertical'}} placeholder="Describe sample handling, storage conditions, transfer log…" />
        </Field>
      </FieldGroup>
    </FormShell>
  )
}

