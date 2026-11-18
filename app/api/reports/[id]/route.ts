import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

const REVIEW_ROLES = ['system_admin', 'park_manager', 'ranger', 'scientist']
const VALID_STATUSES = ['pending', 'approved', 'rejected'] as const

type ValidationStatus = (typeof VALID_STATUSES)[number]

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !REVIEW_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const db = serviceKey
      ? createSupabaseAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
      : supabase

    const { data: report, error } = await db
      .from('citizen_science_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !report) {
      return NextResponse.json({ error: error?.message || 'Report not found' }, { status: 404 })
    }

    return NextResponse.json({ report })
  } catch (err) {
    console.error('GET /api/reports/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single()

    if (!profile || !REVIEW_ROLES.includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden — only authorized staff can update or validate reports.' },
        { status: 403 }
      )
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const db = serviceKey
      ? createSupabaseAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
      : supabase

    const { data: existing, error: fetchErr } = await db
      .from('citizen_science_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json(
        { error: fetchErr?.message || 'Incident report not found.' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (typeof body.incident_type === 'string' && body.incident_type.trim()) {
      updates.incident_type = body.incident_type.trim()
    }

    if (body.severity !== undefined && body.severity !== null) {
      const sev = Number(body.severity)
      if (isNaN(sev) || sev < 1 || sev > 5) {
        return NextResponse.json({ error: 'Severity must be between 1 and 5.' }, { status: 400 })
      }
      updates.severity = Math.round(sev)
    }

    if (typeof body.description === 'string') {
      const trimmedDesc = body.description.trim()
      if (!trimmedDesc) {
        return NextResponse.json({ error: 'Description cannot be empty.' }, { status: 400 })
      }
      updates.description = trimmedDesc
    }

    if (body.gps_lat !== undefined && body.gps_lat !== null && body.gps_lat !== '') {
      const lat = Number(body.gps_lat)
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return NextResponse.json({ error: 'Invalid GPS latitude.' }, { status: 400 })
      }
      updates.gps_lat = lat
    }

    if (body.gps_lng !== undefined && body.gps_lng !== null && body.gps_lng !== '') {
      const lng = Number(body.gps_lng)
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return NextResponse.json({ error: 'Invalid GPS longitude.' }, { status: 400 })
      }
      updates.gps_lng = lng
    }

    if (body.validator_notes !== undefined) {
      updates.validator_notes =
        typeof body.validator_notes === 'string' && body.validator_notes.trim()
          ? body.validator_notes.trim()
          : null
    }

    let statusDecision: ValidationStatus | null = null
    if (body.validation_status !== undefined) {
      const status = String(body.validation_status) as ValidationStatus
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: 'validation_status must be pending, approved, or rejected.' },
          { status: 400 }
        )
      }
      updates.validation_status = status
      statusDecision = status

      if (status === 'approved' || status === 'rejected') {
        updates.validator_id = user.id
        updates.validated_at = new Date().toISOString()
      } else {
        updates.validator_id = null
        updates.validated_at = null
      }
    }

    const wantEscalate = body.escalate === true
    if (wantEscalate) {
      const currentSev =
        typeof updates.severity === 'number'
          ? updates.severity
          : typeof existing.severity === 'number'
            ? existing.severity
            : 3
      updates.severity = Math.max(4, currentSev)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid update fields provided.' }, { status: 400 })
    }

    const { data: updated, error: updateErr } = await db
      .from('citizen_science_reports')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (updateErr || !updated) {
      return NextResponse.json(
        { error: updateErr?.message || 'Failed to update report.' },
        { status: 400 }
      )
    }

    // Trigger high-severity alert when explicitly escalated OR severity raised to >= 4 from < 4
    const oldSev = typeof existing.severity === 'number' ? existing.severity : 0
    const newSev = typeof updated.severity === 'number' ? updated.severity : 0
    if ((wantEscalate || (newSev >= 4 && oldSev < 4)) && updated.validation_status !== 'rejected') {
      try {
        const { error: alertErr } = await db.from('alerts').insert({
          alert_type: 'severity_high',
          title: `Escalated High-Severity Incident: ${String(updated.incident_type || 'Incident').replace(/_/g, ' ')}`,
          message: `Incident escalated to severity ${newSev}/5 by ${profile.full_name || user.email}. GPS: ${Number(updated.gps_lat).toFixed(4)}, ${Number(updated.gps_lng).toFixed(4)}.`,
          triggered_by: user.id,
          channel: 'in_app',
          is_read: false,
          recipients: {
            severity: newSev,
            incident_type: updated.incident_type || 'other',
            gps_lat: updated.gps_lat,
            gps_lng: updated.gps_lng,
            escalated: true,
          },
          related_record_id: updated.id,
          related_table: 'citizen_science_reports',
        })
        if (alertErr) {
          console.error('PATCH /api/reports/[id] alert insert error:', alertErr)
        }
      } catch (alertErr) {
        console.warn('Non-blocking alert insert failed:', alertErr)
      }
    }

    // Immutable audit trail
    try {
      const isValidationDecision =
        statusDecision === 'approved' || statusDecision === 'rejected'
      await db.from('audit_log').insert({
        user_id: user.id,
        user_email: profile.email ?? user.email ?? null,
        user_role: profile.role,
        action_type: isValidationDecision ? 'validation_decision' : 'update',
        table_name: 'citizen_science_reports',
        record_id: id,
        before_value: {
          incident_type: existing.incident_type,
          severity: existing.severity,
          validation_status: existing.validation_status,
          validator_notes: existing.validator_notes,
        },
        after_value: {
          description: wantEscalate
            ? `Environmental incident escalated to severity ${updated.severity}/5`
            : isValidationDecision
              ? `Environmental incident ${statusDecision}`
              : 'Environmental incident updated',
          incident_type: updated.incident_type,
          severity: updated.severity,
          validation_status: updated.validation_status,
          validator_notes: updated.validator_notes,
        },
        ip_address: request.headers.get('x-forwarded-for') || null,
      })
    } catch (auditErr) {
      console.warn('Non-blocking audit log insert failed:', auditErr)
    }

    return NextResponse.json({
      success: true,
      report: updated,
    })
  } catch (err) {
    console.error('PATCH /api/reports/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
