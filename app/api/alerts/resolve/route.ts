import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

const STAFF_ROLES = ['system_admin', 'park_manager', 'ranger', 'scientist']

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
    }

    const admin = createSupabaseAdmin(supabaseUrl, serviceKey)
    const serverSupabase = await createServerClient()
    let {
      data: { user },
    } = await serverSupabase.auth.getUser()

    if (!user) {
      const authHeader = request.headers.get('authorization') || ''
      const token = authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : ''
      if (token) {
        const { data: tokenData } = await admin.auth.getUser(token)
        if (tokenData?.user) user = tokenData.user
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('role, email, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || !STAFF_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const alertId = typeof body.id === 'string' ? body.id.trim() : ''
    if (!alertId) {
      return NextResponse.json({ error: 'Alert id is required' }, { status: 400 })
    }

    const { data: alertRow, error: fetchErr } = await admin
      .from('alerts')
      .select('*')
      .eq('id', alertId)
      .single()

    if (fetchErr || !alertRow) {
      return NextResponse.json({ error: fetchErr?.message || 'Alert not found' }, { status: 404 })
    }

    const nowIso = new Date().toISOString()
    const existingRecipients =
      alertRow.recipients && typeof alertRow.recipients === 'object'
        ? (alertRow.recipients as Record<string, unknown>)
        : {}

    const { data: updatedAlert, error: updateAlertErr } = await admin
      .from('alerts')
      .update({
        is_read: true,
        recipients: {
          ...existingRecipients,
          resolved_at: nowIso,
          resolved_by: user.id,
        },
      })
      .eq('id', alertId)
      .select('*')
      .single()

    if (updateAlertErr) {
      return NextResponse.json({ error: updateAlertErr.message }, { status: 400 })
    }

    // Sync resolution to linked citizen_science_reports record if present
    let syncedReport = null
    if (alertRow.related_table === 'citizen_science_reports' && alertRow.related_record_id) {
      const { data: linkedReport } = await admin
        .from('citizen_science_reports')
        .select('id, validation_status, validator_notes')
        .eq('id', alertRow.related_record_id)
        .maybeSingle()

      if (linkedReport && linkedReport.validation_status === 'pending') {
        const { data: updatedRep } = await admin
          .from('citizen_science_reports')
          .update({
            validation_status: 'approved',
            validator_id: user.id,
            validated_at: nowIso,
            validator_notes:
              linkedReport.validator_notes ||
              'Incident resolved by park operations team.',
          })
          .eq('id', linkedReport.id)
          .select('id, validation_status, validated_at')
          .single()
        syncedReport = updatedRep ?? null
      }
    }

    // Audit log
    try {
      await admin.from('audit_log').insert({
        user_id: user.id,
        user_email: profile.email ?? user.email ?? null,
        user_role: profile.role,
        action_type: 'update',
        table_name: 'alerts',
        record_id: alertId,
        before_value: { is_read: alertRow.is_read, recipients: existingRecipients },
        after_value: {
          description: `Alert resolved: ${alertRow.title}`,
          status: 'resolved',
          synced_report_id: syncedReport?.id ?? null,
        },
      })
    } catch {}

    return NextResponse.json({
      success: true,
      alert: updatedAlert,
      synced_report: syncedReport,
    })
  } catch (err) {
    console.error('POST /api/alerts/resolve error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
