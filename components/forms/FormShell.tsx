'use client'
import { type ReactNode } from 'react'

interface FormShellProps {
  title: string
  subtitle: string
  frId: string
  children: ReactNode
  onSubmit: (e: React.FormEvent) => void
  loading: boolean
  success: boolean
  error: string | null
  submitLabel?: string
}

export function FormShell({
  title, subtitle, frId, children, onSubmit, loading, success, error, submitLabel = 'Submit'
}: FormShellProps) {
  return (
    <div style={{ padding: '28px 32px', maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{title}</h1>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '3px', background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.25)', color: 'var(--teal)', flexShrink: 0 }}>{frId}</span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{subtitle}</p>
      </div>

      {/* Success banner */}
      {success && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#22c55e', marginBottom: '2px' }}>Submitted successfully</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Data saved to database. You can submit another record.</div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span style={{ fontSize: '0.8rem', color: '#fca5a5' }}>{error}</span>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate>
        {children}

        {/* Submit button */}
        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="submit" disabled={loading}
            style={{ padding: '11px 28px', background: loading ? 'rgba(13,148,136,0.5)' : 'var(--teal)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '0.875rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 150ms', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {loading && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"/></svg>}
            {loading ? 'Submitting...' : submitLabel}
          </button>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>All starred fields are required</span>
        </div>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export function FieldGroup({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div style={{ marginBottom: '22px' }}>
      {title && <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px', paddingBottom: '7px', borderBottom: '1px solid var(--border)' }}>{title}</div>}
      {children}
    </div>
  )
}

export function Field({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: error ? '#fca5a5' : 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '5px' }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
      </label>
      {children}
      {hint && !error && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>{hint}</div>}
      {error && <div style={{ fontSize: '0.68rem', color: '#fca5a5', marginTop: '4px' }}>{error}</div>}
    </div>
  )
}

export const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px',
  padding: '9px 12px', fontSize: '0.875rem', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' as const
}

export const selectStyle: React.CSSProperties = {
  ...inputStyle as object, cursor: 'pointer', appearance: 'none' as const
} as React.CSSProperties

