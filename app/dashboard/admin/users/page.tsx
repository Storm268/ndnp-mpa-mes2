'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ROLE_LABELS, type UserRole } from '@/lib/supabase/client'

interface UserRecord {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  phone: string | null
  is_active: boolean
  created_at: string
  last_login: string | null
}

const ROLE_COLORS: Record<string, string> = {
  system_admin: '#ef4444',
  park_manager: '#f59e0b',
  scientist: '#00bcd4',
  ranger: '#10b981',
  read_only: '#6b7280',
  visitor: '#8b5cf6',
  citizen: '#84cc16',
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'ranger' as UserRole, phone: '' })

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (p?.role !== 'system_admin') { router.push('/dashboard/operational'); return }
    }
    check()
    fetchUsers()
  }, [router])

  async function fetchUsers() {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setCreating(true)
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to create user'); setCreating(false); return }
    setSuccess(`User ${form.email} created successfully!`)
    setForm({ email: '', password: '', full_name: '', role: 'ranger', phone: '' })
    setShowForm(false)
    setCreating(false)
    fetchUsers()
  }

  async function toggleActive(userId: string, isActive: boolean) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, is_active: !isActive }),
    })
    fetchUsers()
  }

  async function changeRole(userId: string, role: UserRole) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role }),
    })
    fetchUsers()
  }

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '8px', color: 'var(--text)',
    fontSize: '13px', outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{ padding: '32px', fontFamily: 'var(--font-jakarta)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: '4px' }}>User Management</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Create and manage park staff and citizen accounts</p>
        </div>
        <button onClick={() => { setShowForm(true); setError(''); setSuccess('') }}
          style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #00bcd4, #0077a8)', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '7px' }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          Create User
        </button>
      </div>

      {/* Notifications */}
      {error && <div style={{ marginBottom: '16px', padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#f87171', fontSize: '13px' }}>{error}</div>}
      {success && <div style={{ marginBottom: '16px', padding: '12px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', color: '#10b981', fontSize: '13px' }}>{success}</div>}

      {/* Create User Form */}
      {showForm && (
        <div style={{ marginBottom: '28px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', boxShadow: 'var(--card-shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>Create New User</h2>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }}>×</button>
          </div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>Full Name</label>
                <input style={inputStyle} placeholder="Dr. Jane Smith" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>Email *</label>
                <input required type="email" style={inputStyle} placeholder="staff@park.gov" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>Password *</label>
                <input required type="password" style={inputStyle} placeholder="Min. 8 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>Phone</label>
                <input style={inputStyle} placeholder="+1 (000) 000-0000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>Role *</label>
                <select required style={{ ...inputStyle, cursor: 'pointer' }} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={creating}
                style={{ padding: '10px 24px', background: creating ? 'rgba(0,188,212,0.4)' : 'linear-gradient(135deg, #00bcd4, #0077a8)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {creating ? 'Creating...' : 'Create User'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: '10px 20px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-dim)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Users', value: users.length, color: '#00bcd4' },
          { label: 'Active', value: users.filter(u => u.is_active).length, color: '#10b981' },
          { label: 'Staff', value: users.filter(u => u.role !== 'citizen').length, color: '#f59e0b' },
          { label: 'Citizens', value: users.filter(u => u.role === 'citizen').length, color: '#84cc16' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ fontSize: '22px', fontWeight: '800', color: s.color, marginBottom: '4px' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input style={{ ...inputStyle, width: '280px' }} placeholder="Search by name or email..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Users Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading users...</div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['User', 'Role', 'Phone', 'Last Login', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '2px' }}>{u.full_name || '—'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <select value={u.role} onChange={e => changeRole(u.id, e.target.value as UserRole)}
                      style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', border: `1px solid ${ROLE_COLORS[u.role] || '#6b7280'}60`, background: `${ROLE_COLORS[u.role] || '#6b7280'}15`, color: ROLE_COLORS[u.role] || '#6b7280', fontFamily: 'inherit', outline: 'none' }}>
                      {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-dim)' }}>{u.phone || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: u.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)', color: u.is_active ? '#10b981' : '#6b7280', border: `1px solid ${u.is_active ? '#10b981' : '#6b7280'}40` }}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <button onClick={() => toggleActive(u.id, u.is_active)}
                      style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-dim)' }}>
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>No users found</div>
          )}
        </div>
      )}
    </div>
  )
}

