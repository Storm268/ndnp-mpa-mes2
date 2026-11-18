import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface RawReportRow {
  id: string
  reporter_id: string | null
  report_type: string
  incident_type: string | null
  species_type: string | null
  severity: number | null
  description: string | null
  gps_lat: number | null
  gps_lng: number | null
  validation_status: string | null
  validator_notes: string | null
  validated_at: string | null
  is_offline_sync: boolean | null
  created_at: string
}

function extractReferenceId(description: string | null): string | null {
  if (!description) return null
  const match = description.match(/(?:Reference|Ref ID):\s*([A-Z0-9-]+)/i)
  return match ? match[1].toUpperCase() : null
}

function extractTitle(row: RawReportRow): string {
  if (row.description) {
    const titleMatch = row.description.match(/^\[([^\]]+)\]/)
    if (titleMatch && titleMatch[1].trim()) {
      return titleMatch[1].trim()
    }
  }
  if (row.incident_type) {
    return row.incident_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
  if (row.species_type) {
    return row.species_type
  }
  return row.report_type === 'wildlife_sighting' ? 'Wildlife Sighting' : 'Incident Report'
}

function sanitizeDescription(description: string | null, isOwner: boolean): string {
  if (!description) return ''
  if (isOwner) return description
  // Strip contact PII line for non-authenticated / device-ref lookups
  return description
    .split('\n')
    .filter((line) => !line.trim().startsWith('👤 Contact:'))
    .join('\n')
    .trim()
}

function formatReport(
  row: RawReportRow,
  currentUserId: string | null,
  resolvedAlertInfo?: { resolved_at?: string }
) {
  const isOwner = Boolean(currentUserId && row.reporter_id === currentUserId)
  const rawStatus = row.validation_status || 'pending'
  const effectiveStatus =
    rawStatus !== 'rejected' && resolvedAlertInfo?.resolved_at
      ? 'resolved'
      : rawStatus
  return {
    id: row.id,
    reference_id: extractReferenceId(row.description),
    title: extractTitle(row),
    report_type: row.report_type,
    incident_type: row.incident_type,
    species_type: row.species_type,
    severity: row.severity ?? 2,
    status: effectiveStatus,
    validator_notes: row.validator_notes ?? null,
    validated_at: row.validated_at ?? resolvedAlertInfo?.resolved_at ?? null,
    gps_lat: row.gps_lat,
    gps_lng: row.gps_lng,
    is_offline_sync: Boolean(row.is_offline_sync),
    created_at: row.created_at,
    description: sanitizeDescription(row.description, isOwner),
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    let {
      data: { user },
    } = await supabase.auth.getUser()

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
    }

    const db = serviceKey ? createSupabaseAdmin(supabaseUrl, serviceKey) : supabase

    if (!user && serviceKey) {
      const authHeader = request.headers.get('authorization') || ''
      const token = authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : ''
      if (token) {
        const { data: tokenData } = await db.auth.getUser(token)
        if (tokenData?.user) user = tokenData.user
      }
    }

    const searchParams = request.nextUrl.searchParams
    const refParam = searchParams.get('ref')?.trim()
    const idsParam = searchParams.get('ids')?.trim()

    const selectCols =
      'id, reporter_id, report_type, incident_type, species_type, severity, description, gps_lat, gps_lng, validation_status, validator_notes, validated_at, is_offline_sync, created_at'

    // 1. Single Reference ID or UUID lookup
    if (refParam) {
      const cleanedRef = refParam.replace(/[^a-zA-Z0-9-]/g, '')
      if (!cleanedRef || cleanedRef.length < 4) {
        return NextResponse.json(
          { error: 'Please enter a valid Reference ID (e.g. INC-...).' },
          { status: 400 }
        )
      }

      let matchedRow: RawReportRow | null = null

      if (UUID_REGEX.test(cleanedRef)) {
        const { data } = await db
          .from('citizen_science_reports')
          .select(selectCols)
          .eq('id', cleanedRef)
          .maybeSingle()
        matchedRow = (data as RawReportRow | null) ?? null
      } else {
        const { data } = await db
          .from('citizen_science_reports')
          .select(selectCols)
          .ilike('description', `%Reference: ${cleanedRef}%`)
          .order('created_at', { ascending: false })
          .limit(1)

        if (data && data.length > 0) {
          matchedRow = data[0] as RawReportRow
        } else {
          // Also check legacy "Ref ID:" tag
          const { data: legacyData } = await db
            .from('citizen_science_reports')
            .select(selectCols)
            .ilike('description', `%Ref ID: ${cleanedRef}%`)
            .order('created_at', { ascending: false })
            .limit(1)
          if (legacyData && legacyData.length > 0) {
            matchedRow = legacyData[0] as RawReportRow
          }
        }
      }

      if (!matchedRow) {
        return NextResponse.json(
          { error: `No report found matching reference "${cleanedRef.toUpperCase()}".` },
          { status: 404 }
        )
      }

      let resolvedInfo: { resolved_at?: string } | undefined
      const { data: linkedAlerts } = await db
        .from('alerts')
        .select('recipients')
        .eq('related_table', 'citizen_science_reports')
        .eq('related_record_id', matchedRow.id)
      for (const al of linkedAlerts ?? []) {
        const rec = al.recipients as Record<string, unknown> | null
        if (rec && typeof rec.resolved_at === 'string') {
          resolvedInfo = { resolved_at: rec.resolved_at }
          break
        }
      }

      return NextResponse.json({
        report: formatReport(matchedRow, user?.id ?? null, resolvedInfo),
      })
    }

    // 2. Fetch reports for authenticated user + optional device-local IDs
    const resultsMap = new Map<string, RawReportRow>()

    if (user) {
      const { data: userReports } = await db
        .from('citizen_science_reports')
        .select(selectCols)
        .eq('reporter_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      for (const row of (userReports ?? []) as RawReportRow[]) {
        resultsMap.set(row.id, row)
      }
    }

    if (idsParam) {
      const validIds = idsParam
        .split(',')
        .map((s) => s.trim())
        .filter((s) => UUID_REGEX.test(s))
        .slice(0, 50)

      if (validIds.length > 0) {
        const { data: idReports } = await db
          .from('citizen_science_reports')
          .select(selectCols)
          .in('id', validIds)
          .order('created_at', { ascending: false })

        for (const row of (idReports ?? []) as RawReportRow[]) {
          if (!resultsMap.has(row.id)) {
            resultsMap.set(row.id, row)
          }
        }
      }
    }

    const reportIds = Array.from(resultsMap.keys())
    const resolvedByReportId = new Map<string, { resolved_at?: string }>()
    if (reportIds.length > 0) {
      const { data: linkedAlerts } = await db
        .from('alerts')
        .select('related_record_id, recipients')
        .eq('related_table', 'citizen_science_reports')
        .in('related_record_id', reportIds)
      for (const al of linkedAlerts ?? []) {
        const rec = al.recipients as Record<string, unknown> | null
        if (
          typeof al.related_record_id === 'string' &&
          rec &&
          typeof rec.resolved_at === 'string'
        ) {
          resolvedByReportId.set(al.related_record_id, { resolved_at: rec.resolved_at })
        }
      }
    }

    const merged = Array.from(resultsMap.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((row) => formatReport(row, user?.id ?? null, resolvedByReportId.get(row.id)))

    return NextResponse.json({ reports: merged })
  } catch (err) {
    console.error('GET /api/reports/status error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
