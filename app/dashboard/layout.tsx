import { redirect }         from 'next/navigation'
import { createClient }     from '@/lib/supabase/server'
import { Sidebar }          from '@/components/nav/sidebar'
import OfflineBar           from '@/components/offline/OfflineBar'
import type { UserRole }    from '@/lib/supabase/client'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const role     = (profile?.role as UserRole) ?? 'visitor'
  const fullName = profile?.full_name ?? user.email ?? null

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar role={role} fullName={fullName} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minWidth: 0 }}>
        {/* Offline status bar — shows when offline or syncing queued reports */}
        <OfflineBar />
        <div style={{ flex: 1 }}>{children}</div>
      </main>
    </div>
  )
}

