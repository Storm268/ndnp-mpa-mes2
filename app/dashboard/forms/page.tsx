import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { UserRole } from '@/lib/supabase/client'

const FORMS = [
  { id: 'FR-FORM-01', href: '/dashboard/forms/coral',       title: 'Coral Monitoring',           desc: '24 variables · benthic cover · bleaching count · GPS', icon: 'M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12', color: '#0d9488', roles: ['system_admin','park_manager','scientist','ranger'] as UserRole[] },
  { id: 'FR-FORM-02', href: '/dashboard/forms/fish',        title: 'Fish Survey',                desc: '16 variables · species dropdown · multi-row entry · GPS', icon: 'M6.5 12c0 1.1.4 2.1 1.1 2.8L3 19l4.2-4.2c.7.7 1.7 1.2 2.8 1.2 2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4z', color: '#4fb3e8', roles: ['system_admin','park_manager','scientist','ranger'] as UserRole[] },
  { id: 'FR-FORM-03', href: '/dashboard/forms/heritage',    title: 'Heritage Condition',         desc: '27 variables · condition ratings · element issues · GPS', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', color: '#f59e0b', roles: ['system_admin','park_manager','scientist','ranger'] as UserRole[] },
  { id: 'FR-FORM-04', href: '/dashboard/forms/patrol',      title: 'Patrol Log',                 desc: '20 variables · GPS start/end · violations · fuel entry', icon: 'M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z', color: '#4fb3e8', roles: ['system_admin','park_manager','ranger'] as UserRole[] },
  { id: 'FR-FORM-05', href: '/dashboard/forms/water-quality', title: 'Water Quality',            desc: '23 variables · pH · DO · temperature · chain of custody', icon: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z', color: '#0891b2', roles: ['system_admin','park_manager','scientist','ranger'] as UserRole[] },
  { id: 'FR-FORM-06', href: '/dashboard/forms/visitor-survey', title: 'Visitor Survey',          desc: '18 variables · activities · XCD expenditure · ratings', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', color: '#8b5cf6', roles: ['system_admin','park_manager','ranger'] as UserRole[] },
  { id: 'FR-FORM-07', href: '/dashboard/forms/wildlife',    title: 'Wildlife Sighting',          desc: 'Citizen science · species · behaviour · GPS · photo', icon: 'M2 12a10 10 0 1 0 20 0A10 10 0 0 0 2 12zm10-4a4 4 0 1 1 0 8 4 4 0 0 1 0-8z', color: '#22c55e', roles: ['system_admin','park_manager','scientist','ranger','visitor'] as UserRole[] },
  { id: 'FR-FORM-08', href: '/dashboard/forms/incident',    title: 'Environmental Incident',     desc: 'Citizen science · severity 1–5 · auto-alert for 4–5 · GPS', icon: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0-3.42 0zM12 9v4m0 4h.01', color: '#ef4444', roles: ['system_admin','park_manager','scientist','ranger','visitor'] as UserRole[] },
]

export default async function FormsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile?.role as UserRole) ?? 'visitor'

  const visible = FORMS.filter(f => f.roles.includes(role))

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1000px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '4px' }}>Data Collection Forms</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{visible.length} form{visible.length !== 1 ? 's' : ''} available for your role · All support offline submission via sync queue</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {visible.map(form => (
          <Link key={form.id} href={form.href}
            style={{ display: 'block', textDecoration: 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '18px 20px', transition: 'border-color 150ms, background 150ms', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${form.color}18`, border: `1px solid ${form.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={form.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={form.icon}/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '2px' }}>{form.title}</div>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: form.color }}>{form.id}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
            <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{form.desc}</p>
          </Link>
        ))}
      </div>

      {visible.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No forms are available for your current role.
        </div>
      )}
    </div>
  )
}

