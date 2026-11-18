import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

const VALID_ACTIONS = new Set([
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'failed_login',
  'password_change',
  'permission_change',
  'user_created',
  'validation_decision',
])

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const actionType = String(body.action ?? '').trim()
    if (!VALID_ACTIONS.has(actionType)) {
      return NextResponse.json({ error: 'Invalid audit action type' }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json({ error: 'Server audit configuration missing' }, { status: 500 })
    }

    const admin = createSupabaseAdmin(supabaseUrl, serviceKey)
    const { data: profile } = await admin
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .maybeSingle()

    const metadata =
      body.metadata && typeof body.metadata === 'object' ? body.metadata : {}

    const { error } = await admin.from('audit_log').insert({
      user_id: user.id,
      user_email: profile?.email ?? user.email ?? null,
      user_role: profile?.role ?? null,
      action_type: actionType,
      table_name: typeof body.tableName === 'string' ? body.tableName : null,
      record_id: typeof body.recordId === 'string' && body.recordId ? body.recordId : null,
      after_value: {
        description: typeof body.description === 'string' ? body.description : null,
        ...metadata,
      },
      ip_address: request.headers.get('x-forwarded-for') || null,
      user_agent:
        typeof body.userAgent === 'string'
          ? body.userAgent.slice(0, 200)
          : request.headers.get('user-agent')?.slice(0, 200) ?? null,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('audit log API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
