'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormShell, FieldGroup, Field, inputStyle, selectStyle } from '@/components/forms/FormShell'
import { GPSCapture } from '@/components/forms/GPSCapture'

const CARIBBEAN_SPECIES = [
  'Acanthurus bahianus','Acanthurus chirurgus','Acanthurus coeruleus','Aulostomus maculatus',
  'Bodianus rufus','Cantherhines macrocerus','Cephalopholis cruentata','Cephalopholis fulva',
  'Chaetodon capistratus','Chaetodon striatus','Chromis cyanea','Chromis multilineata',
  'Epinephelus adscensionis','Epinephelus guttatus','Gramma loreto','Haemulon chrysargyreum',
  'Haemulon flavolineatum','Haemulon plumieri','Halichoeres bivittatus','Hypoplectrus puella',
  'Lutjanus apodus','Lutjanus griseus','Lutjanus synagris','Microspathodon chrysurus',
  'Mycteroperca bonaci','Mycteroperca venenosa','Ocyurus chrysurus','Pomacanthus arcuatus',
  'Pomacanthus paru','Scarus guacamaia','Scarus vetula','Sphyraena barracuda','Stegastes partitus',
  'Thalassoma bifasciatum','Xanthichthys ringens','Other (specify in notes)',
]

const SIZE_CLASSES = ['<5cm','5-15cm','15-30cm','30-50cm','>50cm']

interface SpeciesEntry { species: string; count: string; size_class: string }

export default function FishForm() {
  const [stations, setStations] = useState<{id: string; station_code: string; name: string}[]>([])
  const [station_id, setStationId] = useState('')
  const [entries, setEntries] = useState<SpeciesEntry[]>([{ species: '', count: '', size_class: '5-15cm' }])
  const [gpsLat, setGpsLat] = useState(''); const [gpsLng, setGpsLng] = useState('')
  const [transectLen, setTransectLen] = useState(''); const [transectW, setTransectW] = useState('')
  const [depth, setDepth] = useState(''); const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false); const [success, setSuccess] = useState(false); const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    createClient().from('monitoring_stations').select('id, station_code, name').in('station_type', ['fish','multi']).eq('is_active', true).order('station_code')
      .then(({ data }) => setStations(data ?? []))
  }, [])

  function addEntry() { setEntries(p => [...p, { species: '', count: '', size_class: '5-15cm' }]) }
  function removeEntry(i: number) { setEntries(p => p.filter((_, idx) => idx !== i)) }
  function updateEntry(i: number, k: keyof SpeciesEntry, v: string) {
    setEntries(p => p.map((e, idx) => idx === i ? {...e, [k]: v} : e))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!station_id) e.station_id = 'Station is required'
    if (!gpsLat || !gpsLng) e.gps = 'GPS coordinates are required'
    const valid = entries.filter(en => en.species && en.count && parseInt(en.count) > 0)
    if (valid.length === 0) e.entries = 'At least one species entry with count > 0 is required'
    entries.forEach((en, i) => {
      if (en.species && en.count && parseInt(en.count) <= 0) e[`entry_${i}`] = 'Count must be positive'
    })
    setErrors(e); return Object.keys(e).length === 0
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true); setSubmitError(null); setSuccess(false)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setSubmitError('Not logged in'); setLoading(false); return }
    const species_entries = entries.filter(en => en.species && en.count).map(en => ({ species: en.species, count: parseInt(en.count), size_class: en.size_class }))
    const { error } = await sb.from('fish_surveys').insert({
      station_id, surveyor_id: user.id,
      species_entries,
      transect_len_m: transectLen ? parseFloat(transectLen) : null,
      transect_width_m: transectW ? parseFloat(transectW) : null,
      depth_m: depth ? parseFloat(depth) : null,
      gps_lat: parseFloat(gpsLat), gps_lng: parseFloat(gpsLng),
      notes: notes || null, is_offline_sync: false, surveyed_at: new Date().toISOString(),
    })
    if (error) { setSubmitError(error.message); setLoading(false); return }
    setSuccess(true); setLoading(false)
    setStationId(''); setEntries([{ species: '', count: '', size_class: '5-15cm' }])
    setGpsLat(''); setGpsLng(''); setTransectLen(''); setTransectW(''); setDepth(''); setNotes('')
  }

  return (
    <FormShell title="Fish Survey" subtitle="Record Caribbean reef fish species with counts, size classes, and transect measurements" frId="FR-FORM-02" onSubmit={onSubmit} loading={loading} success={success} error={submitError}>
      <FieldGroup title="Station & Location">
        <Field label="Monitoring Station" required error={errors.station_id}>
          <select value={station_id} onChange={e => setStationId(e.target.value)} style={selectStyle}>
            <option value="">Select station…</option>
            {stations.map(s => <option key={s.id} value={s.id}>{s.station_code} — {s.name}</option>)}
          </select>
        </Field>
        <Field label="GPS Coordinates" required error={errors.gps}>
          <GPSCapture lat={gpsLat} lng={gpsLng} onCapture={(lat, lng) => { setGpsLat(lat.toFixed(6)); setGpsLng(lng.toFixed(6)) }} required />
        </Field>
      </FieldGroup>

      <FieldGroup title="Transect Parameters">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <Field label="Transect Length (m)"><input type="number" step="0.5" value={transectLen} onChange={e => setTransectLen(e.target.value)} style={inputStyle} placeholder="e.g. 25" /></Field>
          <Field label="Transect Width (m)"><input type="number" step="0.5" value={transectW} onChange={e => setTransectW(e.target.value)} style={inputStyle} placeholder="e.g. 4" /></Field>
          <Field label="Depth (m)"><input type="number" step="0.5" value={depth} onChange={e => setDepth(e.target.value)} style={inputStyle} placeholder="e.g. 8" /></Field>
        </div>
      </FieldGroup>

      <FieldGroup title="Species Entries">
        {errors.entries && <div style={{ fontSize: '0.72rem', color: '#fca5a5', marginBottom: '10px' }}>{errors.entries}</div>}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Species (Caribbean Taxonomy)', 'Count', 'Size Class', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((en, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(26,58,82,0.4)' }}>
                  <td style={{ padding: '6px 8px' }}>
                    <select value={en.species} onChange={e => updateEntry(i, 'species', e.target.value)}
                      style={{ ...selectStyle, fontSize: '0.78rem', padding: '6px 8px' }}>
                      <option value="">Select species…</option>
                      {CARIBBEAN_SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {errors[`entry_${i}`] && <div style={{ fontSize: '0.65rem', color: '#fca5a5', marginTop: '2px' }}>{errors[`entry_${i}`]}</div>}
                  </td>
                  <td style={{ padding: '6px 8px', width: '80px' }}>
                    <input type="number" min="1" value={en.count} onChange={e => updateEntry(i, 'count', e.target.value)}
                      style={{ ...inputStyle, fontSize: '0.82rem', padding: '6px 8px', textAlign: 'center' }} placeholder="0" />
                  </td>
                  <td style={{ padding: '6px 8px', width: '110px' }}>
                    <select value={en.size_class} onChange={e => updateEntry(i, 'size_class', e.target.value)}
                      style={{ ...selectStyle, fontSize: '0.78rem', padding: '6px 8px' }}>
                      {SIZE_CLASSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '6px 8px', width: '36px' }}>
                    {entries.length > 1 && (
                      <button type="button" onClick={() => removeEntry(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4h4v2"/></svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addEntry}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--teal)', fontWeight: 600 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Species Row
        </button>
      </FieldGroup>

      <FieldGroup title="Notes">
        <Field label="Observation Notes">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{...inputStyle, resize: 'vertical'}} placeholder="Additional observations, behaviour, habitat notes…" />
        </Field>
      </FieldGroup>
    </FormShell>
  )
}

