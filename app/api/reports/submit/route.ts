import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

const PARK_CENTER_LAT = 17.0058
const PARK_CENTER_LNG = -61.7641

const INCIDENT_TYPE_MAP: Record<string, string> = {
  coral_damage: 'Coral Damage',
  illegal_fishing: 'Illegal Fishing',
  pollution: 'Pollution / Dumping',
  wildlife_disturbance: 'Wildlife Disturbance',
  vessel_violation: 'Vessel Violation',
  other: 'Other Threat',
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Database service configuration missing.' },
        { status: 500 }
      )
    }

    const admin = createSupabaseAdmin(supabaseUrl, serviceRoleKey)
    const body = await request.json()

    const rawReportType = String(body.report_type || '').trim().toLowerCase()
    const isWildlife = rawReportType === 'wildlife_sighting' || rawReportType === 'wildlife'
    const report_type = isWildlife ? 'wildlife_sighting' : 'environmental_incident'

    const incident_type = isWildlife
      ? null
      : body.incident_type || rawReportType || 'other'

    const species_type = isWildlife ? (body.species_type || null) : null
    const species_count = isWildlife && body.species_count ? parseInt(body.species_count, 10) : null
    const behavior = isWildlife ? (body.behavior || null) : null

    // Severity validation (1-5)
    let severity = typeof body.severity === 'number' ? body.severity : parseInt(body.severity, 10)
    if (isNaN(severity) || severity < 1 || severity > 5) {
      severity = isWildlife ? null : 3
    }

    // Latitude & Longitude with fallback to NDNP center
    let gps_lat = typeof body.gps_lat === 'number' ? body.gps_lat : parseFloat(body.gps_lat)
    let gps_lng = typeof body.gps_lng === 'number' ? body.gps_lng : parseFloat(body.gps_lng)

    if (isNaN(gps_lat) || gps_lat === null || gps_lat === undefined) {
      gps_lat = PARK_CENTER_LAT
    }
    if (isNaN(gps_lng) || gps_lng === null || gps_lng === undefined) {
      gps_lng = PARK_CENTER_LNG
    }

    // Photos
    const photo_urls = Array.isArray(body.photo_urls) ? body.photo_urls.filter((u: unknown) => typeof u === 'string') : []

    // Compile informative description
    const refId = body.reference_id || `INC-${Date.now().toString(36).toUpperCase()}`
    const title = body.title ? String(body.title).trim() : ''
    const rawDesc = body.description ? String(body.description).trim() : ''
    const locationText = body.location_text || body.location_description ? String(body.location_text || body.location_description).trim() : ''
    const contactParts = [body.contact_name, body.contact_email, body.contact_phone].filter(Boolean).map(s => String(s).trim())

    const descSections: string[] = []
    if (title) descSections.push(`[${title}]`)
    if (rawDesc) descSections.push(rawDesc)
    if (locationText) descSections.push(`📍 Location details: ${locationText}`)
    descSections.push(`🆔 Reference: ${refId}`)
    if (contactParts.length > 0) {
      descSections.push(`👤 Contact: ${contactParts.join(' | ')}`)
    } else {
      descSections.push(`👤 Reporter: Anonymous public report`)
    }

    const description = descSections.join('\n\n')

    // Reporter ID: if provided, verify or use
    let reporter_id = body.reporter_id || null
    if (reporter_id && typeof reporter_id === 'string') {
      // Validate that reporter_id is a UUID or matches profiles
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(reporter_id)) {
        reporter_id = null
      }
    }

    const insertPayload = {
      reporter_id,
      report_type,
      incident_type,
      species_type,
      species_count,
      behavior,
      severity,
      description,
      photo_urls,
      gps_lat,
      gps_lng,
      validation_status: 'pending',
      is_offline_sync: Boolean(body.is_offline_sync),
    }

    const { data, error } = await admin
      .from('citizen_science_reports')
      .insert(insertPayload)
      .select('id, created_at, report_type, incident_type, severity')
      .single()

    if (error) {
      console.error('Error inserting report:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // High severity alert dispatch (non-blocking)
    if (severity && severity >= 4) {
      try {
        const typeLabel = (incident_type && INCIDENT_TYPE_MAP[incident_type]) || incident_type || 'Environmental Incident'
        await admin.from('alerts').insert({
          alert_type: 'severity_high',
          title: `High-Severity Incident: ${typeLabel}`,
          message: `A severity ${severity} environmental incident has been reported at GPS ${gps_lat.toFixed(4)}, ${gps_lng.toFixed(4)}. Reference: ${refId}. Immediate inspection required.`,
          triggered_by: reporter_id,
          channel: 'in_app',
          is_read: false,
          related_record_id: data.id,
          related_table: 'citizen_science_reports',
        })
      } catch (alertErr) {
        console.warn('Failed to insert alert for high severity incident:', alertErr)
      }
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      reference_id: refId,
      report: data,
    }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('Submit report error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
