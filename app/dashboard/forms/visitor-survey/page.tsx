'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormShell, FieldGroup, Field, inputStyle, selectStyle } from '@/components/forms/FormShell'

const ACTIVITIES = [
  'Snorkelling','Scuba Diving','Kayaking / Paddleboarding','Glass-bottom Boat Tour',
  'Hiking / Nature Walk','Heritage / Cultural Visit','Bird Watching','Photography',
  'Swimming / Beach','Fishing (recreational)','Sailing / Yacht','Research / Education',
]

const COUNTRIES = [
  'Antigua and Barbuda','Barbados','Belize','Cuba','Dominica','Dominican Republic',
  'Grenada','Guyana','Haiti','Jamaica','Saint Kitts and Nevis','Saint Lucia',
  'Saint Vincent and the Grenadines','Suriname','Trinidad and Tobago',
  'United Kingdom','United States','Canada','France','Germany','Netherlands','Other',
]

export default function VisitorSurveyForm() {
  const [countryOfOrigin, setCountry] = useState('')
  const [selectedActivities, setActivities] = useState<string[]>([])
  const [expenditure, setExpenditure] = useState('')
  const [stayDays, setStayDays] = useState('')
  const [satisfaction, setSatisfaction] = useState(0)
  const [conservationAwareness, setConservationAwareness] = useState<boolean | null>(null)
  const [comments, setComments] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false); const [success, setSuccess] = useState(false); const [submitError, setSubmitError] = useState<string | null>(null)

  function toggleActivity(a: string) {
    setActivities(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a])
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!countryOfOrigin) e.country = 'Country of origin is required'
    if (selectedActivities.length === 0) e.activities = 'At least one activity must be selected'
    if (expenditure && parseFloat(expenditure) > 50000) e.expenditure = 'Expenditure cannot exceed $50,000 XCD'
    if (expenditure && parseFloat(expenditure) < 0) e.expenditure = 'Expenditure cannot be negative'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true); setSubmitError(null); setSuccess(false)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from('visitor_surveys').insert({
      surveyor_id: user?.id ?? null,
      country_of_origin: countryOfOrigin,
      activities: selectedActivities,
      expenditure_xcd: expenditure ? parseFloat(expenditure) : null,
      length_of_stay_days: stayDays ? parseInt(stayDays) : null,
      satisfaction_rating: satisfaction || null,
      conservation_awareness: conservationAwareness,
      comments: comments || null,
      is_offline_sync: false, surveyed_at: new Date().toISOString(),
    })
    if (error) { setSubmitError(error.message); setLoading(false); return }
    setSuccess(true); setLoading(false)
    setCountry(''); setActivities([]); setExpenditure(''); setStayDays(''); setSatisfaction(0)
    setConservationAwareness(null); setComments('')
  }

  return (
    <FormShell title="Visitor Survey" subtitle="Record visitor activities, expenditure, satisfaction, and conservation awareness" frId="FR-FORM-06" onSubmit={onSubmit} loading={loading} success={success} error={submitError}>
      <FieldGroup title="Visitor Information">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Country of Origin" required error={errors.country}>
            <select value={countryOfOrigin} onChange={e => setCountry(e.target.value)} style={selectStyle}>
              <option value="">Select country…</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Length of Stay (days)">
            <input type="number" min="1" value={stayDays} onChange={e => setStayDays(e.target.value)} style={inputStyle} placeholder="e.g. 7" />
          </Field>
        </div>
        <Field label="Total Expenditure (XCD $)" error={errors.expenditure} hint="Eastern Caribbean Dollar · max $50,000 XCD">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>XCD $</span>
            <input type="number" step="0.01" min="0" max="50000" value={expenditure} onChange={e => setExpenditure(e.target.value)}
              style={{...inputStyle, paddingLeft: '56px'}} placeholder="0.00" />
          </div>
        </Field>
      </FieldGroup>

      <FieldGroup title="Activities">
        {errors.activities && <div style={{ fontSize: '0.72rem', color: '#fca5a5', marginBottom: '8px' }}>{errors.activities}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '7px' }}>
          {ACTIVITIES.map(a => (
            <label key={a} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: selectedActivities.includes(a) ? 'rgba(13,148,136,0.1)' : 'var(--surface)', border: `1px solid ${selectedActivities.includes(a) ? 'rgba(13,148,136,0.4)' : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', color: selectedActivities.includes(a) ? 'var(--teal)' : 'var(--text)', transition: 'all 150ms' }}>
              <input type="checkbox" checked={selectedActivities.includes(a)} onChange={() => toggleActivity(a)}
                style={{ accentColor: 'var(--teal)', width: '14px', height: '14px' }} />
              {a}
            </label>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title="Experience Rating">
        <Field label="Satisfaction Rating (1–5)">
          <div style={{ display: 'flex', gap: '8px' }}>
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button" onClick={() => setSatisfaction(n)}
                style={{ flex: 1, padding: '10px 4px', border: `2px solid ${n === satisfaction ? '#8b5cf6' : 'var(--border)'}`, borderRadius: '7px', background: n === satisfaction ? 'rgba(139,92,246,0.12)' : 'var(--surface)', cursor: 'pointer', fontSize: '1.2rem', color: n <= satisfaction ? '#f59e0b' : 'var(--text-muted)', transition: 'all 150ms' }}>
                {n <= satisfaction ? '★' : '☆'}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Conservation Awareness" hint="Is the visitor aware of marine conservation efforts?">
          <div style={{ display: 'flex', gap: '10px' }}>
            {[{ val: true, label: 'Yes' }, { val: false, label: 'No' }].map(opt => (
              <button key={opt.label} type="button" onClick={() => setConservationAwareness(opt.val)}
                style={{ flex: 1, padding: '9px', border: `1px solid ${conservationAwareness === opt.val ? 'rgba(13,148,136,0.5)' : 'var(--border)'}`, borderRadius: '7px', background: conservationAwareness === opt.val ? 'rgba(13,148,136,0.1)' : 'var(--surface)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: conservationAwareness === opt.val ? 'var(--teal)' : 'var(--text-muted)', transition: 'all 150ms' }}>
                {opt.label}
              </button>
            ))}
          </div>
        </Field>
      </FieldGroup>

      <FieldGroup title="Comments">
        <Field label="Additional Comments">
          <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3}
            style={{...inputStyle, resize: 'vertical'}} placeholder="Any additional visitor feedback, suggestions, observations…" />
        </Field>
      </FieldGroup>
    </FormShell>
  )
}

