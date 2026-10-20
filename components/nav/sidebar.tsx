'use client'
import { PWAInstallButton } from '@/components/pwa/PWAInstallButton'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient, type UserRole, ROLE_LABELS } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import {
  Activity,
  Compass,
  Shield,
  Landmark,
  ClipboardList,
  Map as MapIcon,
  Bell,
  FileBarChart,
  Layers,
  ScrollText,
  Users,
  LogOut,
  Sparkles,
} from 'lucide-react'

const ALL_STAFF: UserRole[] = ['system_admin', 'park_manager', 'scientist', 'ranger', 'read_only']
const MANAGERS:  UserRole[] = ['system_admin', 'park_manager']

function NavLink({ href, label, icon, active, badge, badgeCount }: {
  href: string; label: string; icon: React.ReactNode
  active: boolean; badge?: boolean; badgeCount?: number
}) {
  return (
    <Link href={href} style={{ display:'flex', alignItems:'center', gap:'9px', padding:'8px 10px', borderRadius:'7px', marginBottom:'2px', textDecoration:'none', fontSize:'0.82rem', fontWeight: active ? 600 : 400, color: active ? 'var(--teal-light)' : 'var(--text-dim)', background: active ? 'rgba(13,148,136,0.12)' : 'transparent', transition:'all 150ms', cursor:'pointer', position:'relative' }}>
      <div style={{ position:'relative', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
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

function AdminLink({ href, label, icon, active }: { href: string; label: string; icon: React.ReactNode; active: boolean }) {
  return (
    <Link href={href} style={{ display:'flex', alignItems:'center', gap:'9px', padding:'8px 10px', borderRadius:'7px', marginBottom:'2px', textDecoration:'none', fontSize:'0.82rem', fontWeight: active ? 600 : 400, color: active ? 'var(--teal-light)' : 'var(--text-dim)', background: active ? 'rgba(13,148,136,0.12)' : 'transparent', transition:'all 150ms', cursor:'pointer' }}>
      <div style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {icon}
      </div>
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
    window.location.href = '/'
  }

  return (
    <aside style={{ width:'240px', minHeight:'100vh', background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, position:'sticky', top:0, height:'100vh' }}>

      {/* Brand */}
      <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'34px', height:'34px', background:'rgba(13,148,136,0.15)', border:'1px solid rgba(13,148,136,0.35)', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Sparkles size={18} color="#0d9488" />
          </div>
          <div>
            <div style={{ fontSize:'0.75rem', fontWeight:800, color:'var(--text)', letterSpacing:'-0.01em', lineHeight:1.2 }}>NDNP MPA-MES</div>
            <div style={{ fontSize:'0.6rem', color:'var(--text-muted)', letterSpacing:'0.02em' }}>Field Operations Portal</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'12px 10px', overflowY:'auto' }}>
        {role === 'citizen' && (
          <>
            <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', padding:'0 6px', marginBottom:'6px' }}>Citizen Stewardship</div>
            <NavLink href="/dashboard/citizen" label="Citizen Portal" icon={<Sparkles size={16} />} active={pathname.startsWith('/dashboard/citizen')} />
            <NavLink href="/report" label="Report Sighting / Hazard" icon={<Shield size={16} />} active={pathname.startsWith('/report')} />
          </>
        )}

        {ALL_STAFF.includes(role) && (
          <>
            <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', padding:'0 6px', marginBottom:'6px' }}>Dashboards</div>
            <NavLink href="/dashboard/operational" label="Operational" icon={<Activity size={16} />} active={pathname.startsWith('/dashboard/operational')} />
            {['system_admin','park_manager','scientist'].includes(role) && <NavLink href="/dashboard/ecological" label="Ecological" icon={<Compass size={16} />} active={pathname.startsWith('/dashboard/ecological')} />}
            {['system_admin','park_manager','ranger'].includes(role) && <NavLink href="/dashboard/patrol" label="Patrol & Incidents" icon={<Shield size={16} />} active={pathname.startsWith('/dashboard/patrol')} />}
            {['system_admin','park_manager','scientist','ranger'].includes(role) && <NavLink href="/dashboard/heritage" label="Heritage Condition" icon={<Landmark size={16} />} active={pathname.startsWith('/dashboard/heritage')} />}
            <NavLink href="/dashboard/forms" label="Data Collection" icon={<ClipboardList size={16} />} active={pathname.startsWith('/dashboard/forms')} />
            <NavLink href="/dashboard/maps" label="Park Map" icon={<MapIcon size={16} />} active={pathname.startsWith('/dashboard/maps')} />

            {/* Community & Citizen Section for Staff */}
            <div style={{ marginTop:'10px', paddingTop:'10px', borderTop:'1px solid var(--border)' }}>
              <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', padding:'0 6px', marginBottom:'4px' }}>Citizen Stewardship</div>
              <NavLink href="/dashboard/citizen" label="Citizen Portal" icon={<Sparkles size={16} />} active={pathname.startsWith('/dashboard/citizen')} />
            </div>
          </>
        )}

        {/* Management section */}
        {MANAGERS.includes(role) && (
          <div style={{ marginTop:'10px', paddingTop:'10px', borderTop:'1px solid var(--border)' }}>
            <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', padding:'0 6px', marginBottom:'4px' }}>Management</div>

            <NavLink href="/dashboard/alerts" label="Alerts" icon={<Bell size={16} />} active={pathname.startsWith('/dashboard/alerts')} badge badgeCount={unreadCount} />
            <NavLink href="/dashboard/reports" label="Reports" icon={<FileBarChart size={16} />} active={pathname.startsWith('/dashboard/reports')} />

            {/* Layer management — managers & admins */}
            <NavLink
              href="/dashboard/admin/layers"
              label="GIS Layers"
              icon={<Layers size={16} />}
              active={pathname.startsWith('/dashboard/admin/layers')}
            />

            {role === 'system_admin' && (
              <>
                <AdminLink href="/dashboard/audit" label="Audit Log" icon={<ScrollText size={16} />} active={pathname.startsWith('/dashboard/audit')} />
                <AdminLink href="/dashboard/admin/users" label="User Management" icon={<Users size={16} />} active={pathname.startsWith('/dashboard/admin/users')} />
              </>
            )}
          </div>
        )}
      </nav>

      {/* User info + sign out */}
      <div style={{ padding:'12px 10px', borderTop:'1px solid var(--border)' }}>
        <div style={{ padding:'6px 10px', marginBottom:'6px', background:'var(--surface2)', borderRadius:'7px', border:'1px solid var(--border)' }}>
          <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text)', marginBottom:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fullName ?? 'User'}</div>
          <div style={{ fontSize:'0.65rem', color:'var(--teal)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em' }}>{ROLE_LABELS[role]}</div>
        </div>
        <PWAInstallButton variant="sidebar" />
        <button onClick={handleSignOut} disabled={signingOut}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', borderRadius:'7px', border:'none', background:'transparent', color:'var(--text-muted)', fontSize:'0.78rem', cursor:'pointer', transition:'all 150ms' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#fca5a5' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <LogOut size={14} />
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>

      <style>{`@keyframes livePulse { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
    </aside>
  )
}
