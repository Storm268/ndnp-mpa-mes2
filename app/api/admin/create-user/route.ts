import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Verify caller is system_admin
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'system_admin') {
      return NextResponse.json({ error: 'Forbidden — system_admin only' }, { status: 403 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured on server' }, { status: 500 })
    }

    const { email, password, full_name, role, phone } = await request.json()
    if (!email || !password || !role) {
      return NextResponse.json({ error: 'email, password, and role are required' }, { status: 400 })
    }

    // Create user via Supabase Admin API
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    )

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for staff accounts
      user_metadata: { full_name, role, phone },
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Upsert profile with role
    await adminClient.from('profiles').upsert({
      id: data.user.id,
      email,
      full_name: full_name || null,
      phone: phone || null,
      role,
      is_active: true,
    })

    // Log admin action
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'admin.create_user',
      table_name: 'profiles',
      record_id: data.user.id,
      new_data: { email, role, full_name },
      ip_address: request.headers.get('x-forwarded-for') || null,
    })

    return NextResponse.json({ success: true, user_id: data.user.id })
  } catch (err) {
    console.error('create-user error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

