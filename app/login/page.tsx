'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/theme-toggle'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)', position: 'relative' }}>
      {/* Theme toggle bar */}
      <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
        <ThemeToggle />
      </div>

      {/* Logo mark */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(13,148,136,0.15)', border: '1px solid rgba(13,148,136,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/>
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10"/>
            <path d="M12 8v4l3 3"/>
          </svg>
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', marginBottom: '4px' }}>NDNP MPA-MES</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Marine Protected Area Management & Ecological System</p>
      </div>

      {/* Login form */}
      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '28px 24px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>Staff Sign In</h2>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '7px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.8rem', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>Email Address</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email"
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', padding: '10px 12px', fontSize: '0.875rem', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = 'var(--teal)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required autoComplete="current-password"
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', padding: '10px 12px', fontSize: '0.875rem', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = 'var(--teal)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <button
            type="submit" disabled={loading}
            style={{ width: '100%', background: loading ? 'rgba(13,148,136,0.5)' : 'var(--teal)', color: '#fff', border: 'none', borderRadius: '7px', padding: '11px', fontSize: '0.875rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 150ms' }}
            onMouseEnter={e => !loading && ((e.target as HTMLButtonElement).style.background = 'var(--teal-light)')}
            onMouseLeave={e => !loading && ((e.target as HTMLButtonElement).style.background = 'var(--teal)')}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Staff accounts are provisioned by your System Administrator.
        </p>
      </form>
    </div>
  )
}

