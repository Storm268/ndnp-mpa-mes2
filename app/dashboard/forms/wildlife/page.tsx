'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormShell, FieldGroup, Field, inputStyle, selectStyle } from '@/components/forms/FormShell'
import { GPSCapture } from '@/components/forms/GPSCapture'

const SPECIES_TYPES = [
  'Sea Turtle (Green)','Sea Turtle (Hawksbill)','Sea Turtle (Leatherback)','Sea Turtle (Loggerhead)',
  'Manatee / Dugong','Dolphin (Bottlenose)','Dolphin (Spinner)','Whale (Humpback)','Whale (Sperm)',
  'Manta Ray','Eagle Ray','Bull Shark','Nurse Shark','Whale Shark',
  'Queen Conch','Lobster (Caribbean Spiny)','Sea Bird (Frigatebird)','Sea Bird (Pelican)',
  'Sea Bird (Booby)','Marine Iguana','Other (specify in notes)',
]

const BEHAVIORS = [
  'Resting','Feeding','Nesting','Swimming / Active','Foraging','Socialising',
  'Injured / Distressed','Entangled','Stranded','Unknown',
]

export default function WildlifeForm() {
  const [speciesType, setSpeciesType] = useState('')
  const [speciesCount, setSpeciesCount] = useState('1')
  const [behavior, setBehavior] = useState('')
  const [gpsLat, setGpsLat] = useState(''); const [gpsLng, setGpsLng] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false); const [success, setSuccess] = useState(false); const [submitError, setSubmitError] = useState<string | null>(null)

  function validate() {
    const e: Record<string, string> = {}
    if (!speciesType) e.speciesType = 'Species selection is required'
    if (!gpsLat || !gpsLng) e.gps = 'GPS coordinates are required'
    if (!speciesCount || parseInt(speciesCount) < 1) e.count = 'Count must be at least 1'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true); setSubmitError(null); setSuccess(false)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from('citizen_science_reports').insert({
      reporter_id: user?.id ?? null,
      report_type: 'wildlife_sighting',
      species_type: speciesType,
      species_count: parseInt(speciesCount),
      behavior: behavior || null,
      gps_lat: parseFloat(gpsLat), gps_lng: parseFloat(gpsLng),
      description: notes || null,
      validation_status: 'pending',
      is_offline_sync: false,
    })
    if (error) { setSubmitError(error.message); setLoading(false); return }
    setSuccess(true); setLoading(false)
    setSpeciesType(''); setSpeciesCount('1'); setBehavior(''); setGpsLat(''); setGpsLng(''); setNotes('')
  }

  return (
    <FormShell title="Wildlife Sighting" subtitle="Report a marine or coastal wildlife sighting. Your report will be reviewed by a park scientist." frId="FR-FORM-07" onSubmit={onSubmit} loading={loading} success={success} error={submitError} submitLabel="Submit Sighting">
      <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', fontSize: '0.78rem', color: '#86efac' }}>
        Thank you for contributing to citizen science. Your sighting will be validated by a park scientist and added to the monitoring database.
      </div>

      <FieldGroup title="Species Information">
        <Field label="Species" required error={errors.speciesType}>
          <select value={speciesType} onChange={e => setSpeciesType(e.target.value)} style={selectStyle}>
            <option value="">Select species…</option>
            {SPECIES_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Count (individuals)" required error={errors.count}>
            <input type="number" min="1" value={speciesCount} onChange={e => setSpeciesCount(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Behaviour Observed">
            <select value={behavior} onChange={e => setBehavior(e.target.value)} style={selectStyle}>
              <option value="">Select behaviour…</option>
              {BEHAVIORS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup title="Location">
        <Field label="GPS Coordinates" required error={errors.gps} hint="Tap &lsquo;Capture GPS&rsquo; to use your device location">
          <GPSCapture lat={gpsLat} lng={gpsLng} onCapture={(lat, lng) => { setGpsLat(lat.toFixed(6)); setGpsLng(lng.toFixed(6)) }} required />
        </Field>
      </FieldGroup>

      <FieldGroup title="Additional Details">
        <Field label="Notes" hint="Describe what you observed, any unusual behaviour, environmental conditions">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
            style={{...inputStyle, resize: 'vertical'}} placeholder="Describe the sighting in as much detail as possible. Photos are strongly encouraged — upload via the park app or email them to the research team." />
        </Field>
      </FieldGroup>
    </FormShell>
  )
}

