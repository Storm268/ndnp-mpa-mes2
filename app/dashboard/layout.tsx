import { createClient }     from '@/lib/supabase/server'
import { Sidebar }          from '@/components/nav/sidebar'
import { ThemeToggle }      from '@/components/theme-toggle'
import type { UserRole }    from '@/lib/supabase/client'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let role: UserRole = 'citizen'
  let fullName: string | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    role = (profile?.role as UserRole) ?? 'citizen'
    fullName = profile?.full_name ?? user.email ?? null
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Sidebar role={role} fullName={fullName} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minWidth: 0 }}>
        {/* Top Operations Header Bar */}
        <header
          style={{
            height: '52px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--header-bg)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              NDNP Operations Hub
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Appearance:</span>
            <ThemeToggle />
          </div>
        </header>

        {/* Offline status bar globally mounted in root layout */}
        <div style={{ flex: 1 }}>{children}</div>
      </main>
    </div>
  )
}
