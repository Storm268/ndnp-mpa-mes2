'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormShell, FieldGroup, Field, inputStyle, selectStyle } from '@/components/forms/FormShell'
import { GPSCapture } from '@/components/forms/GPSCapture'
import PhotoCapture from '@/components/forms/PhotoCapture'
import { audit } from '@/lib/audit/log-action'

const BENTHIC_CATS = [
  { key: 'hard_coral', label: 'Hard Coral' },
  { key: 'soft_coral', label: 'Soft Coral' },
  { key: 'algae',      label: 'Algae / Turf' },
  { key: 'sand',       label: 'Sand / Rubble' },
  { key: 'sponge',     label: 'Sponge' },
  { key: 'other',      label: 'Other Biota' },
]

export default function CoralForm() {
  const [stations,    setStations]    = useState<{id: string; station_code: string; name: string}[]>([])
  const [photoUrls,   setPhotoUrls]   = useState<string[]>([])
  const [form, setForm] = useState({
    station_id: '', depth_m: '', live_coral_pct: '',
    bleaching_count: '0', bleaching_pct: '',
    water_temp_c: '', visibility_m: '', notes: '',
    gps_lat: '', gps_lng: '',
  })
  const [benthic, setBenthic] = useState<Record<string, number>>({
    hard_coral: 0, soft_coral: 0, algae: 0, sand: 100, sponge: 0, other: 0
  })
  const [errors,      setErrors]      = useState<Record<string, string>>({})
  const [loading,     setLoading]     = useState(false)
  const [success,     setSuccess]     = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.from('monitoring_stations')
      .select('id, station_code, name')
      .in('station_type', ['coral','multi'])
      .eq('is_active', true)
      .order('station_code')
      .then(({ data }) => setStations(data ?? []))
  }, [])

  const benthicSum = Object.values(benthic).reduce((a, b) => a + b, 0)
  const set = (k: string, v: string) => setForm(p => ({...p, [k]: v}))

  function validate() {
    const e: Record<string, string> = {}
    if (!form.station_id) e.station_id = 'Station is required'
    if (!form.depth_m || parseFloat(form.depth_m) <= 0) e.depth_m = 'Depth must be a positive number'
    if (!form.live_coral_pct || parseFloat(form.live_coral_pct) < 0 || parseFloat(form.live_coral_pct) > 100) e.live_coral_pct = 'Must be 0–100'
    if (Math.abs(benthicSum - 100) > 1) e.benthic = `Benthic categories must sum to 100% (currently ${benthicSum}%)`
    if (!form.gps_lat || !form.gps_lng) e.gps = 'GPS coordinates are required — tap Pick on Map'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true); setSubmitError(null); setSuccess(false)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setSubmitError('You must be logged in.'); setLoading(false); return }

    const { error } = await sb.from('coral_surveys').insert({
      station_id:      form.station_id,
      depth_m:         parseFloat(form.depth_m),
      live_coral_pct:  parseFloat(form.live_coral_pct),
      bleaching_count: parseInt(form.bleaching_count) || 0,
      bleaching_pct:   form.bleaching_pct ? parseFloat(form.bleaching_pct) : null,
      benthic_cover:   benthic,
      water_temp_c:    form.water_temp_c  ? parseFloat(form.water_temp_c)  : null,
      visibility_m:    form.visibility_m  ? parseFloat(form.visibility_m)  : null,
      gps_lat:         parseFloat(form.gps_lat),
      gps_lng:         parseFloat(form.gps_lng),
      photo_urls:      photoUrls.length > 0 ? photoUrls : null,
      notes:           form.notes || null,
      surveyor_id:     user.id,
      is_offline_sync: false,
      surveyed_at:     new Date().toISOString(),
    })

    if (error) { setSubmitError(error.message); setLoading(false); return }
    setSuccess(true); setLoading(false)
    await audit.formSubmit('coral_surveys', '', 'Coral Monitoring Survey')
    setForm({ station_id: '', depth_m: '', live_coral_pct: '', bleaching_count: '0', bleaching_pct: '', water_temp_c: '', visibility_m: '', notes: '', gps_lat: '', gps_lng: '' })
    setBenthic({ hard_coral: 0, soft_coral: 0, algae: 0, sand: 100, sponge: 0, other: 0 })
    setPhotoUrls([])
  }

  return (
    <FormShell title="Coral Reef Monitoring" subtitle="Record benthic cover, coral health, bleaching observations, and in-situ measurements" frId="FR-FORM-01" onSubmit={onSubmit} loading={loading} success={success} error={submitError}>

      <FieldGroup title="Station & Location">
        <Field label="Monitoring Station" required error={errors.station_id}>
          <select value={form.station_id} onChange={e => set('station_id', e.target.value)} style={selectStyle}>
            <option value="">Select station…</option>
            {stations.map(s => <option key={s.id} value={s.id}>{s.station_code} — {s.name}</option>)}
          </select>
        </Field>
        <Field label="GPS Coordinates" required error={errors.gps}>
          <GPSCapture lat={form.gps_lat} lng={form.gps_lng}
            onCapture={(lat, lng) => setForm(p => ({...p, gps_lat: lat.toFixed(6), gps_lng: lng.toFixed(6)}))}
            required />
        </Field>
      </FieldGroup>

      <FieldGroup title="Survey Parameters">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Depth (m)" required error={errors.depth_m}>
            <input type="number" step="0.1" min="0.1" value={form.depth_m} onChange={e => set('depth_m', e.target.value)} style={inputStyle} placeholder="e.g. 5.5" />
          </Field>
          <Field label="Water Temperature (°C)">
            <input type="number" step="0.1" value={form.water_temp_c} onChange={e => set('water_temp_c', e.target.value)} style={inputStyle} placeholder="e.g. 27.3" />
          </Field>
          <Field label="Visibility (m)">
            <input type="number" step="0.5" value={form.visibility_m} onChange={e => set('visibility_m', e.target.value)} style={inputStyle} placeholder="e.g. 15" />
          </Field>
          <Field label="Live Coral Cover (%)" required error={errors.live_coral_pct}>
            <input type="number" step="0.1" min="0" max="100" value={form.live_coral_pct} onChange={e => set('live_coral_pct', e.target.value)} style={inputStyle} placeholder="0–100" />
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup title="Benthic Cover Categories">
        <div style={{ background:'var(--surface)', border:`1px solid ${errors.benthic ? 'rgba(239,68,68,0.5)' : 'var(--border)'}`, borderRadius:'8px', padding:'16px', marginBottom:'4px' }}>
          {BENTHIC_CATS.map(cat => (
            <div key={cat.key} style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' }}>
              <div style={{ width:'110px', fontSize:'0.78rem', color:'var(--text)', flexShrink:0 }}>{cat.label}</div>
              <input type="range" min={0} max={100} value={benthic[cat.key]}
                onChange={e => setBenthic(p => ({...p, [cat.key]: parseInt(e.target.value)}))}
                style={{ flex:1, accentColor:'var(--teal)' }} />
              <div style={{ width:'42px', textAlign:'right', fontSize:'0.8rem', fontWeight:700, color:'var(--teal)' }}>{benthic[cat.key]}%</div>
            </div>
          ))}
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Total must equal 100%</span>
            <span style={{ fontSize:'0.9rem', fontWeight:800, color: Math.abs(benthicSum-100) <= 1 ? 'var(--green)' : '#ef4444' }}>{benthicSum}%</span>
          </div>
        </div>
        {errors.benthic && <div style={{ fontSize:'0.68rem', color:'#fca5a5', marginTop:'4px' }}>{errors.benthic}</div>}
      </FieldGroup>

      <FieldGroup title="Bleaching Observations">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <Field label="Bleaching Count" hint="Number of bleached colonies">
            <input type="number" min="0" value={form.bleaching_count} onChange={e => set('bleaching_count', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Bleaching (%)" hint="% of coral affected">
            <input type="number" step="0.1" min="0" max="100" value={form.bleaching_pct} onChange={e => set('bleaching_pct', e.target.value)} style={inputStyle} placeholder="0–100" />
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup title="Photos">
        <PhotoCapture value={photoUrls} onChange={setPhotoUrls} maxPhotos={8} />
      </FieldGroup>

      <FieldGroup title="Notes">
        <Field label="Observation Notes">
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            style={{...inputStyle, resize:'vertical'}}
            placeholder="Additional observations, abnormalities, environmental conditions…" />
        </Field>
      </FieldGroup>
    </FormShell>
  )
}

