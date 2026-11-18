import { createClient } from '@/lib/supabase/server'
import PatrolDashboardClient, {
  type PatrolLogItem,
  type CSIncidentItem,
} from '@/components/patrol/PatrolDashboardClient'

export const dynamic = 'force-dynamic'

const REVIEW_ROLES = ['system_admin', 'park_manager', 'ranger', 'scientist']

export default async function PatrolDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let canReview = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    canReview = Boolean(profile?.role && REVIEW_ROLES.includes(profile.role))
  }

  const [
    { data: activePatrols },
    { data: recentPatrols },
    { data: csIncidents },
  ] = await Promise.all([
    supabase
      .from('patrol_logs')
      .select('id, ranger_id, patrol_type, sector, start_lat, start_lng, start_time, violations, warnings, vessel_id, profiles(full_name)')
      .eq('is_active', true)
      .order('start_time', { ascending: false }),
    supabase
      .from('patrol_logs')
      .select('id, ranger_id, patrol_type, sector, start_time, end_time, violations, warnings, fuel_used_l, profiles(full_name)')
      .eq('is_active', false)
      .order('start_time', { ascending: false })
      .limit(10),
    supabase
      .from('citizen_science_reports')
      .select('id, reporter_id, report_type, severity, incident_type, description, photo_urls, gps_lat, gps_lng, validation_status, validator_id, validator_notes, validated_at, is_offline_sync, created_at')
      .eq('report_type', 'environmental_incident')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const normalizedActive = (activePatrols ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    profiles: Array.isArray(p.profiles) ? (p.profiles[0] ?? null) : (p.profiles ?? null),
  })) as PatrolLogItem[]

  const normalizedRecent = (recentPatrols ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    profiles: Array.isArray(p.profiles) ? (p.profiles[0] ?? null) : (p.profiles ?? null),
  })) as PatrolLogItem[]

  return (
    <PatrolDashboardClient
      activePatrols={normalizedActive}
      recentPatrols={normalizedRecent}
      initialIncidents={(csIncidents ?? []) as CSIncidentItem[]}
      canReview={canReview}
    />
  )
}
