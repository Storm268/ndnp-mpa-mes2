'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import PhotoCapture from '@/components/forms/PhotoCapture'
import { enqueueReport } from '@/lib/offline/db'
import { ThemeToggle } from '@/components/theme-toggle'

const MapLocationLoader = dynamic(() => import('@/components/forms/MapLocationLoader'), { ssr: false })

const REPORT_TYPES = [
  { value: 'coral_damage',         label: 'Coral Damage',         color: '#ef4444' },
  { value: 'illegal_fishing',      label: 'Illegal Fishing',      color: '#f59e0b' },
  { value: 'pollution',            label: 'Pollution / Dumping',  color: '#8b5cf6' },
  { value: 'wildlife_disturbance', label: 'Wildlife Disturbance', color: '#10b981' },
  { value: 'vessel_violation',     label: 'Vessel Violation',     color: '#00bcd4' },
  { value: 'other',                label: 'Other Threat',         color: '#6b7280' },
]

const SEV_LABEL = ['', 'Low — Observe only', 'Moderate — Monitor', 'Significant — Investigate', 'High — Urgent', 'Critical — Emergency']
const SEV_COLOR = ['', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444']

interface SignedInReporter {
  id: string
  full_name: string
  email: string
  phone: string
}

export default function ReportPage() {
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [refId,     setRefId]     = useState('')
  const [savedOffline, setSavedOffline] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])    // uploaded URLs
  const [photoBlobs, setPhotoBlobs] = useState<string[]>([])  // base64 for offline
  const [location, setLocation]   = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null })
  const [signedInUser, setSignedInUser] = useState<SignedInReporter | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [includeAccountInfo, setIncludeAccountInfo] = useState(true)

  const [form, setForm] = useState({
    report_type: '', title: '', description: '',
    location_text: '', severity: 3,
    contact_name: '', contact_email: '', contact_phone: '',
  })
  const update = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    async function loadSignedInUser() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, phone')
          .eq('id', user.id)
          .maybeSingle()

        const info: SignedInReporter = {
          id: user.id,
          full_name: profile?.full_name || (user.user_metadata?.full_name as string) || '',
          email: profile?.email || user.email || '',
          phone: profile?.phone || (user.user_metadata?.phone as string) || '',
        }
        setSignedInUser(info)
        setForm(f => ({
          ...f,
          contact_name: info.full_name,
          contact_email: info.email,
          contact_phone: info.phone,
        }))
      } catch {
        // Leave as anonymous if auth lookup fails
      } finally {
        setAuthChecked(true)
      }
    }
    loadSignedInUser()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.report_type) { setError('Please select an incident type.'); return }
    if (!form.description)  { setError('Please provide a description.'); return }
    setError(''); setLoading(true)

    const ref = `INC-${Date.now().toString(36).toUpperCase()}`

    // Check if user is logged in
    const supabase = createClient()
    const [{ data: { user } }, { data: { session } }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ])
    const activeUserId = user?.id || signedInUser?.id || null
    if (user && !signedInUser) {
      setSignedInUser({
        id: user.id,
        full_name: (user.user_metadata?.full_name as string) || '',
        email: user.email || '',
        phone: (user.user_metadata?.phone as string) || '',
      })
    }
    const shouldLinkAccount = Boolean(activeUserId && includeAccountInfo)

    const payload: Record<string, unknown> = {
      report_type:          form.report_type,
      incident_type:        form.report_type,
      title:                form.title || `${REPORT_TYPES.find(r => r.value === form.report_type)?.label} Report`,
      description:          form.description,
      location_text:        form.location_text || null,
      gps_lat:              location.lat ?? 17.0058,
      gps_lng:              location.lng ?? -61.7641,
      severity:             form.severity,
      contact_name:         shouldLinkAccount ? (signedInUser?.full_name || form.contact_name || null) : (signedInUser ? null : (form.contact_name || null)),
      contact_email:        shouldLinkAccount ? (signedInUser?.email || user?.email || form.contact_email || null) : (signedInUser ? null : (form.contact_email || null)),
      contact_phone:        shouldLinkAccount ? (signedInUser?.phone || form.contact_phone || null) : (signedInUser ? null : (form.contact_phone || null)),
      photo_urls:           photoUrls.length > 0 ? photoUrls : [],
      reference_id:         ref,
      reporter_id:          shouldLinkAccount ? activeUserId : null,
      include_account_info: shouldLinkAccount,
    }

    // ── OFFLINE: save to IndexedDB queue ───────────────────────────────────
    if (!navigator.onLine) {
      try {
        await enqueueReport({
          form_type:   'incident_public',
          table:       'citizen_science_reports',
          payload,
          photo_blobs: photoBlobs.length > 0 ? photoBlobs : undefined,
        })
        setRefId(ref)
        setSavedOffline(true)
        setSubmitted(true)
      } catch {
        setError('Failed to save offline. Please try again.')
      }
      setLoading(false)
      return
    }

    // ── ONLINE: submit via server API endpoint ──────────────────────────────
    try {
      const res = await fetch('/api/reports/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        setError(`Submission failed: ${result.error || 'Server error occurred'}`)
        setLoading(false)
        return
      }
      const submittedId = result.id as string | undefined
      if (submittedId && typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('ndnp_citizen_report_ids')
          const existing: string[] = raw ? JSON.parse(raw) : []
          const next = [submittedId, ...existing.filter((x) => x !== submittedId)].slice(0, 50)
          localStorage.setItem('ndnp_citizen_report_ids', JSON.stringify(next))
        } catch {}
      }
      setRefId(result.reference_id || ref)
      setSubmitted(true)
      setLoading(false)
    } catch {
      setError('Network error: Unable to submit report. Please check your connection or save offline.')
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width:'100%', padding:'11px 14px',
    background:'var(--surface2)', border:'1px solid var(--border)',
    borderRadius:'8px', color:'var(--text)', fontSize:'14px', outline:'none', fontFamily:'inherit',
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 16px', fontFamily:'var(--font-jakarta)' }}>
      <div style={{ width:'100%', maxWidth:'580px' }}>
        <div style={{ textAlign:'center', marginBottom:'28px', position:'relative' }}>
          <div style={{ position:'absolute', top:0, right:0 }}>
            <ThemeToggle />
          </div>
          <Link href={signedInUser ? '/dashboard/citizen' : '/'} style={{ display:'inline-flex', alignItems:'center', gap:'8px', textDecoration:'none', marginBottom:'16px' }}>
            <span style={{ fontSize:'13px', color:'var(--text-muted)' }}>{signedInUser ? '← Back to Citizen Portal' : '← Back to Home'}</span>
          </Link>
          <br />
          {signedInUser && includeAccountInfo ? (
            <>
              <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'5px 12px', borderRadius:'20px', background:'rgba(0,188,212,0.1)', border:'1px solid rgba(0,188,212,0.3)', marginBottom:'14px' }}>
                <span style={{ fontSize:'12px', color:'var(--teal)', fontWeight:'600' }}>SIGNED-IN REPORTING · TRACKABLE</span>
              </div>
              <h1 style={{ fontSize:'24px', fontWeight:'800', color:'var(--text)', marginBottom:'6px' }}>Submit an Incident Report</h1>
              <p style={{ fontSize:'13px', color:'var(--text-muted)' }}>
                Submitting as <strong style={{ color:'var(--text)' }}>{signedInUser.full_name || signedInUser.email}</strong> — automatically linked to your account for live status tracking.
              </p>
            </>
          ) : (
            <>
              <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'5px 12px', borderRadius:'20px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', marginBottom:'14px' }}>
                <span style={{ fontSize:'12px', color:'#f87171', fontWeight:'600' }}>ANONYMOUS REPORTING</span>
              </div>
              <h1 style={{ fontSize:'24px', fontWeight:'800', color:'var(--text)', marginBottom:'6px' }}>Submit an Incident Report</h1>
              <p style={{ fontSize:'13px', color:'var(--text-muted)' }}>No account required — reviewed within 24 hours.</p>
            </>
          )}
        </div>

        {submitted ? (
          <div style={{ background: savedOffline ? 'rgba(245,158,11,0.06)' : 'rgba(16,185,129,0.06)', border: `1px solid ${savedOffline ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)'}`, borderRadius:'16px', padding:'40px', textAlign:'center', boxShadow:'var(--card-shadow)' }}>
            <div style={{ width:'56px', height:'56px', borderRadius:'50%', background: savedOffline ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              {savedOffline ? (
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
                </svg>
              ) : (
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
              )}
            </div>
            <h2 style={{ fontSize:'20px', fontWeight:'700', color: savedOffline ? '#fbbf24' : '#10b981', marginBottom:'8px' }}>
              {savedOffline ? 'Saved for Later' : 'Report Submitted'}
            </h2>
            <p style={{ fontSize:'13px', color:'var(--text-muted)', marginBottom:'16px' }}>
              {savedOffline
                ? 'Your device is offline. The report is safely stored and will sync automatically when connectivity returns.'
                : signedInUser && includeAccountInfo
                  ? 'Your report is linked to your account. You can track ranger review updates anytime.'
                  : 'Thank you for helping protect the marine park.'}
            </p>
            <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px', marginBottom:'20px' }}>
              <div style={{ fontSize:'11px', color:'var(--text-muted)', marginBottom:'3px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Reference ID</div>
              <div style={{ fontSize:'20px', fontWeight:'800', color:'var(--teal)', fontFamily:'monospace' }}>{refId}</div>
            </div>
            {savedOffline && (
              <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'16px' }}>
                📁 Keep this reference ID — it will appear in the system once synced.
              </div>
            )}
            <div style={{ display:'flex', gap:'10px', justifyContent:'center', flexWrap:'wrap' }}>
              <Link href="/dashboard/citizen?tab=reports" style={{ padding:'9px 18px', background:'linear-gradient(135deg, #00bcd4, #0077a8)', borderRadius:'8px', color:'#ffffff', fontSize:'13px', fontWeight:'700', textDecoration:'none' }}>
                {signedInUser && includeAccountInfo ? 'Track in My Reports' : 'Check Report Status'}
              </Link>
              <Link href={signedInUser ? '/dashboard/citizen' : '/'} style={{ padding:'9px 18px', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text-dim)', fontSize:'13px', fontWeight:'600', textDecoration:'none' }}>
                {signedInUser ? 'Back to Portal' : 'Back to Home'}
              </Link>
              {authChecked && !signedInUser && (
                <Link href="/register" style={{ padding:'9px 18px', background:'rgba(0,188,212,0.15)', border:'1px solid rgba(0,188,212,0.3)', borderRadius:'8px', color:'#00bcd4', fontSize:'13px', fontWeight:'600', textDecoration:'none' }}>Create Account to Track</Link>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'16px', padding:'24px', boxShadow:'var(--card-shadow)' }}>

            {/* Offline notice */}
            {typeof window !== 'undefined' && !navigator.onLine && (
              <div style={{ marginBottom:'16px', padding:'10px 14px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'8px', display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'#fbbf24' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0"/>
                  <line x1="12" y1="20" x2="12.01" y2="20"/>
                </svg>
                <span>You&apos;re offline — your report will be saved locally and synced when connectivity returns.</span>
              </div>
            )}

            {error && (
              <div style={{ marginBottom:'16px', padding:'10px 14px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'8px', color:'#f87171', fontSize:'13px' }}>
                {error}
              </div>
            )}

            {/* Incident Type */}
            <div style={{ marginBottom:'18px' }}>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>Incident Type *</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                {REPORT_TYPES.map(rt => (
                  <button key={rt.value} type="button"
                    onClick={() => update('report_type', rt.value)}
                    style={{ padding:'10px 12px', borderRadius:'8px', fontSize:'13px', fontWeight:'600', cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                      border: form.report_type === rt.value ? `1px solid ${rt.color}` : '1px solid var(--border)',
                      background: form.report_type === rt.value ? `${rt.color}18` : 'var(--surface2)',
                      color: form.report_type === rt.value ? rt.color : 'var(--text-dim)',
                    }}>
                    {rt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom:'14px' }}>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>Brief Title</label>
              <input style={inputStyle} placeholder="e.g. Anchor damage to coral at Reef Point"
                value={form.title} onChange={e => update('title', e.target.value)} />
            </div>

            {/* Description */}
            <div style={{ marginBottom:'14px' }}>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>Description *</label>
              <textarea required rows={4} style={{ ...inputStyle, resize:'vertical', lineHeight:'1.6' }}
                placeholder="Describe what you saw. Include time, extent, vessels, persons involved…"
                value={form.description} onChange={e => update('description', e.target.value)} />
            </div>

            {/* Location picker */}
            <div style={{ marginBottom:'14px' }}>
              <MapLocationLoader label="Incident Location" value={location} onChange={coords => setLocation(coords)} />
              <input style={{ ...inputStyle, marginTop:'8px' }}
                placeholder="Or describe location: e.g. South reef, near Marker Buoy #3"
                value={form.location_text} onChange={e => update('location_text', e.target.value)} />
            </div>

            {/* Severity */}
            <div style={{ marginBottom:'18px' }}>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>Severity *</label>
              <input type="range" min="1" max="5" value={form.severity}
                onChange={e => update('severity', Number(e.target.value))}
                style={{ width:'100%', accentColor: SEV_COLOR[form.severity], cursor:'pointer', marginBottom:'6px' }} />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>1 — Low</span>
                <span style={{ fontSize:'13px', fontWeight:'700', color: SEV_COLOR[form.severity] }}>Level {form.severity}: {SEV_LABEL[form.severity]}</span>
                <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>5 — Critical</span>
              </div>
            </div>

            {/* Photo capture */}
            <div style={{ marginBottom:'18px' }}>
              <PhotoCapture
                value={photoUrls}
                onChange={setPhotoUrls}
                maxPhotos={5}
                onOfflineBlobs={setPhotoBlobs}
              />
            </div>

            {/* Contact / Reporter Info */}
            {signedInUser ? (
              <div style={{ marginBottom:'20px', padding:'14px', background:'var(--surface2)', borderRadius:'10px', border: includeAccountInfo ? '1px solid rgba(0,188,212,0.35)' : '1px solid var(--border)' }}>
                <label style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', marginBottom: includeAccountInfo ? '10px' : '0' }}>
                  <input
                    type="checkbox"
                    checked={includeAccountInfo}
                    onChange={e => setIncludeAccountInfo(e.target.checked)}
                    style={{ width:'16px', height:'16px', accentColor:'#00bcd4', cursor:'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize:'12px', fontWeight:'700', color:'var(--text)', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                      Include my account information to track this report
                    </div>
                    <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>
                      {includeAccountInfo
                        ? 'Your profile contact details will be attached automatically so you can track status in My Reports.'
                        : 'Unchecked — this report will be submitted anonymously without linking your account.'}
                    </div>
                  </div>
                </label>

                {includeAccountInfo && (
                  <div style={{ padding:'10px 12px', borderRadius:'8px', background:'var(--surface)', border:'1px solid var(--border)', display:'flex', flexWrap:'wrap', gap:'12px', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'14px', fontSize:'12px', color:'var(--text-dim)' }}>
                      {signedInUser.full_name && (
                        <span><strong style={{ color:'var(--text)' }}>Name:</strong> {signedInUser.full_name}</span>
                      )}
                      {signedInUser.email && (
                        <span><strong style={{ color:'var(--text)' }}>Email:</strong> {signedInUser.email}</span>
                      )}
                      {signedInUser.phone && (
                        <span><strong style={{ color:'var(--text)' }}>Phone:</strong> {signedInUser.phone}</span>
                      )}
                    </div>
                    <span style={{ fontSize:'10px', fontWeight:700, color:'var(--teal)', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                      Auto-filled from profile
                    </span>
                  </div>
                )}
              </div>
            ) : authChecked ? (
              <div style={{ marginBottom:'20px', padding:'14px', background:'var(--surface2)', borderRadius:'10px', border:'1px solid var(--border)' }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color:'var(--text)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>Contact Info <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, color:'var(--text-muted)' }}>(optional)</span></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  <input style={inputStyle} placeholder="Name" value={form.contact_name} onChange={e => update('contact_name', e.target.value)} />
                  <input style={inputStyle} placeholder="Phone" value={form.contact_phone} onChange={e => update('contact_phone', e.target.value)} />
                  <div style={{ gridColumn:'1/-1' }}>
                    <input type="email" style={inputStyle} placeholder="Email" value={form.contact_email} onChange={e => update('contact_email', e.target.value)} />
                  </div>
                </div>
              </div>
            ) : null}

            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:'13px', background: loading ? 'rgba(239,68,68,0.4)' : 'linear-gradient(135deg,#ef4444,#dc2626)', border:'none', borderRadius:'10px', color:'#fff', fontSize:'15px', fontWeight:'700', cursor: loading ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
              {loading ? 'Saving…' : (typeof window !== 'undefined' && !navigator.onLine ? 'Save for Later (Offline)' : 'Submit Report')}
            </button>

            <p style={{ textAlign:'center', marginTop:'12px', fontSize:'12px', color:'var(--text-muted)' }}>
              Already submitted a report?{' '}
              <Link href="/dashboard/citizen?tab=reports" style={{ color:'#00bcd4', textDecoration:'none', fontWeight:600 }}>Check report status</Link>
              {authChecked && !signedInUser && (
                <>
                  {' · '}
                  <Link href="/login" style={{ color:'#00bcd4', textDecoration:'none', fontWeight:600 }}>Sign In</Link>
                  {' · '}
                  <Link href="/register" style={{ color:'#00bcd4', textDecoration:'none' }}>Create a citizen account</Link>
                </>
              )}
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

