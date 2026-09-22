'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormShell, FieldGroup, Field, inputStyle } from '@/components/forms/FormShell'
import { GPSCapture, RatingSlider } from '@/components/forms/GPSCapture'

const STRUCTURAL_ELEMENTS = [
  { key: 'walls', label: 'Walls / Facades' },
  { key: 'roof', label: 'Roof / Covering' },
  { key: 'foundation', label: 'Foundation / Base' },
  { key: 'stairs', label: 'Stairs / Access' },
  { key: 'windows', label: 'Windows / Openings' },
  { key: 'drainage', label: 'Drainage / Gutters' },
]

const ISSUE_TYPES = [
  'Structural cracking','Vegetation encroachment','Water damage / efflorescence',
  'Graffiti / vandalism','Biological growth','Settlement / subsidence',
  'Material loss','Corrosion / rust','Fire damage','Storm damage',
]

export default function HeritageForm() {
  const [sites, setSites] = useState<{id: string; site_code: string; name: string}[]>([])
  const [site_id, setSiteId] = useState('')
  const [assessorName, setAssessorName] = useState('')
  const [overallRating, setOverallRating] = useState(0)
  const [elementRatings, setElementRatings] = useState<Record<string, number>>({})
  const [selectedIssues, setSelectedIssues] = useState<string[]>([])
  const [narrativeNotes, setNarrativeNotes] = useState('')
  const [gpsLat, setGpsLat] = useState(''); const [gpsLng, setGpsLng] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false); const [success, setSuccess] = useState(false); const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    createClient().from('heritage_sites').select('id, site_code, name').eq('is_active', true).order('site_code')
      .then(({ data }) => setSites(data ?? []))
  }, [])

  function toggleIssue(issue: string) {
    setSelectedIssues(p => p.includes(issue) ? p.filter(i => i !== issue) : [...p, issue])
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!site_id) e.site_id = 'Heritage site is required'
    if (!assessorName.trim()) e.assessorName = 'Assessor name is required'
    if (overallRating === 0) e.overallRating = 'Overall condition rating is required'
    if (!gpsLat || !gpsLng) e.gps = 'GPS coordinates are required'
    const ratedElements = Object.keys(elementRatings).filter(k => elementRatings[k] > 0)
    if (ratedElements.length === 0) e.elements = 'At least one structural element must be rated'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true); setSubmitError(null); setSuccess(false)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setSubmitError('Not logged in'); setLoading(false); return }
    const { error } = await sb.from('heritage_assessments').insert({
      site_id, assessor_id: user.id, assessor_name: assessorName.trim(),
      overall_condition: overallRating,
      element_ratings: elementRatings,
      element_issues: selectedIssues,
      narrative_notes: narrativeNotes || null,
      gps_lat: parseFloat(gpsLat), gps_lng: parseFloat(gpsLng),
      is_offline_sync: false, assessed_at: new Date().toISOString(),
    })
    if (error) { setSubmitError(error.message); setLoading(false); return }
    setSuccess(true); setLoading(false)
    setSiteId(''); setAssessorName(''); setOverallRating(0); setElementRatings({})
    setSelectedIssues([]); setNarrativeNotes(''); setGpsLat(''); setGpsLng('')
  }

  return (
    <FormShell title="Heritage Condition Assessment" subtitle="Rate structural elements, identify issues, and document conservation status of heritage sites" frId="FR-FORM-03" onSubmit={onSubmit} loading={loading} success={success} error={submitError}>
      <FieldGroup title="Site & Assessor">
        <Field label="Heritage Site" required error={errors.site_id}>
          <select value={site_id} onChange={e => setSiteId(e.target.value)}
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', padding: '9px 12px', fontSize: '0.875rem', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' as const }}>
            <option value="">Select heritage site…</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.site_code} — {s.name}</option>)}
          </select>
        </Field>
        <Field label="Assessor Name" required error={errors.assessorName}>
          <input value={assessorName} onChange={e => setAssessorName(e.target.value)} style={inputStyle} placeholder="Full name of assessor" />
        </Field>
        <Field label="GPS Coordinates" required error={errors.gps}>
          <GPSCapture lat={gpsLat} lng={gpsLng} onCapture={(lat, lng) => { setGpsLat(lat.toFixed(6)); setGpsLng(lng.toFixed(6)) }} required />
        </Field>
      </FieldGroup>

      <FieldGroup title="Overall Condition Rating">
        <Field label="Overall Condition" required error={errors.overallRating}>
          <RatingSlider value={overallRating} onChange={setOverallRating} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Structural Element Ratings">
        {errors.elements && <div style={{ fontSize: '0.72rem', color: '#fca5a5', marginBottom: '10px' }}>{errors.elements}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {STRUCTURAL_ELEMENTS.map(el => (
            <div key={el.key}>
              <RatingSlider value={elementRatings[el.key] ?? 0} onChange={v => setElementRatings(p => ({...p, [el.key]: v}))} label={el.label} />
            </div>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title="Issues Identified">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
          {ISSUE_TYPES.map(issue => (
            <label key={issue} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: selectedIssues.includes(issue) ? 'rgba(245,158,11,0.1)' : 'var(--surface)', border: `1px solid ${selectedIssues.includes(issue) ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', color: selectedIssues.includes(issue) ? '#f59e0b' : 'var(--text)', transition: 'all 150ms' }}>
              <input type="checkbox" checked={selectedIssues.includes(issue)} onChange={() => toggleIssue(issue)}
                style={{ accentColor: '#f59e0b', width: '14px', height: '14px' }} />
              {issue}
            </label>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title="Narrative Notes">
        <Field label="Detailed Assessment Notes">
          <textarea value={narrativeNotes} onChange={e => setNarrativeNotes(e.target.value)} rows={4}
            style={{...inputStyle, resize: 'vertical'}} placeholder="Describe condition, urgency, recommended actions, conservation priorities…" />
        </Field>
      </FieldGroup>
    </FormShell>
  )
}

