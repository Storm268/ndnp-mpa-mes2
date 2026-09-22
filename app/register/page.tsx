'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    phone: '',
    nationality: '',
    id_type: '',
    id_number: '',
    address: '',
    agreed: false,
  })

  const update = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!form.agreed) {
      setError('You must accept the terms and conditions.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          role: 'citizen',
          phone: form.phone,
          nationality: form.nationality,
        }
      }
    })
    if (signUpErr) {
      setError(signUpErr.message)
      setLoading(false)
      return
    }
    // Update profile with extra fields
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: form.email,
        full_name: form.full_name,
        phone: form.phone,
        nationality: form.nationality,
        role: 'citizen',
        is_active: true,
      })
    }
    setSuccess(true)
    setLoading(false)
    setTimeout(() => router.push('/dashboard/citizen'), 2000)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', color: '#e2f0f9',
    fontSize: '14px', outline: 'none',
    fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px',
    fontWeight: '600', color: '#7aa3be',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    marginBottom: '6px',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ocean-deep)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px', fontFamily: 'var(--font-jakarta)' }}>
      <div style={{ width: '100%', maxWidth: '540px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #00bcd4, #0077a8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945"/></svg>
            </div>
            <span style={{ fontSize: '13px', color: '#7aa3be' }}>NDNP Marine Park</span>
          </Link>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', marginBottom: '8px', letterSpacing: '-0.3px' }}>Citizen Registration</h1>
          <p style={{ fontSize: '14px', color: '#5a7d94' }}>Create your account to report and track marine incidents</p>
        </div>

        {success ? (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '14px', padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#10b981', marginBottom: '8px' }}>Registration Successful!</h2>
            <p style={{ fontSize: '14px', color: '#7aa3be' }}>Redirecting to your citizen portal...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px' }}>
            {error && (
              <div style={{ marginBottom: '20px', padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#f87171', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Full Name *</label>
                <input required style={inputStyle} placeholder="Your full legal name"
                  value={form.full_name} onChange={e => update('full_name', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Email Address *</label>
                <input required type="email" style={inputStyle} placeholder="you@example.com"
                  value={form.email} onChange={e => update('email', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Password *</label>
                <input required type="password" style={inputStyle} placeholder="Min. 8 characters"
                  value={form.password} onChange={e => update('password', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Confirm Password *</label>
                <input required type="password" style={inputStyle} placeholder="Repeat password"
                  value={form.confirm_password} onChange={e => update('confirm_password', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input style={inputStyle} placeholder="+1 (000) 000-0000"
                  value={form.phone} onChange={e => update('phone', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Nationality</label>
                <input style={inputStyle} placeholder="e.g. Barbadian"
                  value={form.nationality} onChange={e => update('nationality', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>ID Type</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }}
                  value={form.id_type} onChange={e => update('id_type', e.target.value)}>
                  <option value="">Select type</option>
                  <option>National ID</option>
                  <option>Passport</option>
                  <option>Driver&apos;s License</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>ID Number</label>
                <input style={inputStyle} placeholder="Optional"
                  value={form.id_number} onChange={e => update('id_number', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Address</label>
                <input style={inputStyle} placeholder="Your residential address"
                  value={form.address} onChange={e => update('address', e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '24px', padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <input type="checkbox" id="agreed" checked={form.agreed}
                onChange={e => update('agreed', e.target.checked)}
                style={{ marginTop: '2px', cursor: 'pointer', accentColor: '#00bcd4' }} />
              <label htmlFor="agreed" style={{ fontSize: '13px', color: '#7aa3be', lineHeight: '1.5', cursor: 'pointer' }}>
                I agree to the NDNP terms and conditions. My information will be stored securely and used solely for
                park communication and incident tracking purposes.
              </label>
            </div>

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '13px', background: loading ? 'rgba(0,188,212,0.4)' : 'linear-gradient(135deg, #00bcd4, #0077a8)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Creating account...' : 'Create Citizen Account'}
            </button>

            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#5a7d94' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: '#00bcd4', textDecoration: 'none' }}>Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

