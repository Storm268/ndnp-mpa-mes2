import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['system_admin', 'park_manager', 'scientist', 'ranger', 'visitor']
const ALLOWED_ALERT_TYPES = new Set([
  'severity_high',
  'patrol_incident',
  'heritage_critical',
  'bleaching_alert',
  'wq_exceedance',
  'geofence_entry',
  'low_sync',
])

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Database service configuration missing.' }, { status: 500 })
    }

    const serverSupabase = await createServerClient()
    const {
      data: { user },
    } = await serverSupabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || !STAFF_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const alertType = String(body.alert_type || 'patrol_incident').trim()
    if (!ALLOWED_ALERT_TYPES.has(alertType)) {
      return NextResponse.json({ error: 'Invalid alert_type' }, { status: 400 })
    }

    const title = String(body.title || '').trim()
    const message = String(body.message || '').trim()
    if (!title || !message) {
      return NextResponse.json({ error: 'Alert title and message are required.' }, { status: 400 })
    }

    const meta: Record<string, unknown> = {}
    if (body.severity !== undefined && body.severity !== null && !isNaN(Number(body.severity))) {
      meta.severity = Number(body.severity)
    }
    if (typeof body.incident_type === 'string' && body.incident_type.trim()) {
      meta.incident_type = body.incident_type.trim()
    }
    if (body.gps_lat !== undefined && body.gps_lat !== null && !isNaN(Number(body.gps_lat))) {
      meta.gps_lat = Number(body.gps_lat)
    }
    if (body.gps_lng !== undefined && body.gps_lng !== null && !isNaN(Number(body.gps_lng))) {
      meta.gps_lng = Number(body.gps_lng)
    }

    const admin = createSupabaseAdmin(supabaseUrl, serviceRoleKey)
    const { data, error } = await admin
      .from('alerts')
      .insert({
        alert_type: alertType,
        title,
        message,
        triggered_by: user.id,
        channel: 'in_app',
        is_read: false,
        recipients: meta,
        related_record_id: typeof body.related_record_id === 'string' ? body.related_record_id : null,
        related_table: typeof body.related_table === 'string' ? body.related_table : null,
      })
      .select('id, alert_type, title, created_at')
      .single()

    if (error) {
      console.error('POST /api/alerts/trigger insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, alert: data }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('POST /api/alerts/trigger error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
