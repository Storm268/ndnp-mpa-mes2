'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient, type UserRole, ROLE_LABELS } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'

const ALL_STAFF: UserRole[] = ['system_admin', 'park_manager', 'scientist', 'ranger', 'read_only']
const MANAGERS:  UserRole[] = ['system_admin', 'park_manager']

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

function NavLink({ href, label, icon, active, badge, badgeCount }: {
  href: string; label: string; icon: React.ReactNode
  active: boolean; badge?: boolean; badgeCount?: number
}) {
  return (
    <Link href={href} style={{ display:'flex', alignItems:'center', gap:'9px', padding:'8px 10px', borderRadius:'7px', marginBottom:'2px', textDecoration:'none', fontSize:'0.82rem', fontWeight: active ? 600 : 400, color: active ? 'var(--teal-light)' : 'var(--text-dim)', background: active ? 'rgba(13,148,136,0.12)' : 'transparent', transition:'all 150ms', cursor:'pointer', position:'relative' }}>
      <div style={{ position:'relative', flexShrink:0 }}>
        {icon}
        {badge && badgeCount && badgeCount > 0 && (
          <span style={{ position:'absolute', top:'-4px', right:'-4px', width:'7px', height:'7px', borderRadius:'50%', background:'#ef4444', border:'1px solid var(--surface)', animation:'livePulse 2s ease-in-out infinite' }} />
        )}
      </div>
      <span style={{ flex:1 }}>{label}</span>
      {badge && badgeCount && badgeCount > 0 && (
        <span style={{ fontSize:'0.6rem', fontWeight:800, background:'#ef4444', color:'#fff', borderRadius:'8px', padding:'1px 6px', flexShrink:0 }}>
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </Link>
  )
}

function AdminLink({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link href={href} style={{ display:'flex', alignItems:'center', gap:'9px', padding:'8px 10px', borderRadius:'7px', marginBottom:'2px', textDecoration:'none', fontSize:'0.82rem', fontWeight: active ? 600 : 400, color: active ? 'var(--teal-light)' : 'var(--text-dim)', background: active ? 'rgba(13,148,136,0.12)' : 'transparent', transition:'all 150ms', cursor:'pointer' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d={icon} /></svg>
      <span style={{ flex:1 }}>{label}</span>
      <span style={{ fontSize:'0.55rem', fontWeight:700, padding:'1px 4px', borderRadius:'2px', background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>ADMIN</span>
    </Link>
  )
}

export function Sidebar({ role, fullName }: { role: UserRole; fullName: string | null }) {
  const pathname     = usePathname()
  const router       = useRouter()
  const [signingOut,  setSigningOut]  = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!MANAGERS.includes(role)) return
    const sb = createClient()
    async function fetchCount() {
      const { count } = await sb.from('alerts').select('*', { count:'exact', head:true }).eq('is_read', false)
      setUnreadCount(count ?? 0)
    }
    fetchCount()
    const ch = sb.channel('sidebar-alert-count')
      .on('postgres_changes', { event:'*', schema:'public', table:'alerts' }, () => { fetchCount() })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [role])

  async function handleSignOut() {
    setSigningOut(true)
    await createClient().auth.signOut()
    router.push('/')
  }

  return (
    <aside style={{ width:'240px', minHeight:'100vh', background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, position:'sticky', top:0, height:'100vh' }}>

      {/* Brand */}
      <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'34px', height:'34px', background:'rgba(13,148,136,0.15)', border:'1px solid rgba(13,148,136,0.35)', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" /><path d="M12 8v4l3 3" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize:'0.75rem', fontWeight:800, color:'var(--text)', letterSpacing:'-0.01em', lineHeight:1.2 }}>NDNP MPA-MES</div>
            <div style={{ fontSize:'0.6rem', color:'var(--text-muted)', letterSpacing:'0.02em' }}>Field Operations Portal</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'12px 10px', overflowY:'auto' }}>
        <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', padding:'0 6px', marginBottom:'6px' }}>Dashboards</div>

        {ALL_STAFF.includes(role) && (
          <>
            <NavLink href="/dashboard/operational" label="Operational" icon={<NavIcon d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0M12 6v6l4 2" />} active={pathname.startsWith('/dashboard/operational')} />
            {['system_admin','park_manager','scientist'].includes(role) && <NavLink href="/dashboard/ecological" label="Ecological" icon={<NavIcon d="M2 12h2m16 0h2M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />} active={pathname.startsWith('/dashboard/ecological')} />}
            {['system_admin','park_manager','ranger'].includes(role) && <NavLink href="/dashboard/patrol" label="Patrol & Incidents" icon={<NavIcon d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />} active={pathname.startsWith('/dashboard/patrol')} />}
            {['system_admin','park_manager','scientist','ranger'].includes(role) && <NavLink href="/dashboard/heritage" label="Heritage Condition" icon={<NavIcon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />} active={pathname.startsWith('/dashboard/heritage')} />}
            <NavLink href="/dashboard/forms" label="Data Collection" icon={<NavIcon d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />} active={pathname.startsWith('/dashboard/forms')} />
            <NavLink href="/dashboard/maps" label="Park Map" icon={<NavIcon d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6-3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-1.447-.894L15 9m0 8V9m0 0L9 7" />} active={pathname.startsWith('/dashboard/maps')} />
          </>
        )}

        {/* Management section */}
        {MANAGERS.includes(role) && (
          <div style={{ marginTop:'10px', paddingTop:'10px', borderTop:'1px solid var(--border)' }}>
            <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', padding:'0 6px', marginBottom:'4px' }}>Management</div>

            <NavLink href="/dashboard/alerts" label="Alerts" icon={<NavIcon d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />} active={pathname.startsWith('/dashboard/alerts')} badge badgeCount={unreadCount} />
            <NavLink href="/dashboard/reports" label="Reports" icon={<NavIcon d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />} active={pathname.startsWith('/dashboard/reports')} />

            {/* Layer management — managers & admins */}
            <NavLink
              href="/dashboard/admin/layers"
              label="GIS Layers"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                  <polyline points="2 17 12 22 22 17"/>
                  <polyline points="2 12 12 17 22 12"/>
                </svg>
              }
              active={pathname.startsWith('/dashboard/admin/layers')}
            />

            {role === 'system_admin' && (
              <>
                <AdminLink href="/dashboard/audit" label="Audit Log" icon="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" active={pathname.startsWith('/dashboard/audit')} />
                <AdminLink href="/dashboard/admin/users" label="User Management" icon="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" active={pathname.startsWith('/dashboard/admin/users')} />
              </>
            )}
          </div>
        )}
      </nav>

      {/* User info + sign out */}
      <div style={{ padding:'12px 10px', borderTop:'1px solid var(--border)' }}>
        <div style={{ padding:'8px 10px', marginBottom:'6px' }}>
          <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text)', marginBottom:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fullName ?? 'User'}</div>
          <div style={{ fontSize:'0.65rem', color:'var(--teal)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em' }}>{ROLE_LABELS[role]}</div>
        </div>
        <button onClick={handleSignOut} disabled={signingOut}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', borderRadius:'7px', border:'none', background:'transparent', color:'var(--text-muted)', fontSize:'0.78rem', cursor:'pointer', transition:'all 150ms' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#fca5a5' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>

      <style>{`@keyframes livePulse { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
    </aside>
  )
}

