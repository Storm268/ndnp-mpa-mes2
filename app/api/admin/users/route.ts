import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

    const adminClient = createSupabaseAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'system_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: profiles, error } = await adminClient
      .from('profiles')
      .select('id, email, full_name, role, phone, is_active, created_at, last_login_at')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enrich last_login from Supabase Auth and include any auth users missing a profile row
    const authUsersMap = new Map<string, { email?: string; last_sign_in_at?: string | null; created_at?: string; user_metadata?: Record<string, unknown> }>()
    try {
      const { data: authData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
      for (const au of authData?.users ?? []) {
        authUsersMap.set(au.id, au)
      }
    } catch {
      // Non-blocking fallback if auth admin list fails
    }

    const profileIds = new Set((profiles ?? []).map(p => p.id))
    const users = (profiles ?? []).map(p => {
      const authUser = authUsersMap.get(p.id)
      return {
        id: p.id,
        email: p.email ?? authUser?.email ?? '',
        full_name: p.full_name ?? null,
        role: p.role,
        phone: p.phone ?? null,
        is_active: p.is_active ?? true,
        created_at: p.created_at,
        last_login: p.last_login_at ?? authUser?.last_sign_in_at ?? null,
      }
    })

    for (const [id, au] of authUsersMap.entries()) {
      if (!profileIds.has(id)) {
        const meta = au.user_metadata ?? {}
        users.push({
          id,
          email: au.email ?? '',
          full_name: typeof meta.full_name === 'string' ? meta.full_name : null,
          role: typeof meta.role === 'string' ? meta.role : 'citizen',
          phone: typeof meta.phone === 'string' ? meta.phone : null,
          is_active: true,
          created_at: au.created_at ?? new Date().toISOString(),
          last_login: au.last_sign_in_at ?? null,
        })
      }
    }

    return NextResponse.json(
      { users },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('list-users error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

    const adminClient = createSupabaseAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'system_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { user_id, role, is_active } = await request.json()
    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (role !== undefined) updates.role = role
    if (is_active !== undefined) updates.is_active = is_active
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 })
    }

    const { data: beforeProfile } = await adminClient
      .from('profiles')
      .select('role, is_active, email')
      .eq('id', user_id)
      .single()

    const { error } = await adminClient.from('profiles').update(updates).eq('id', user_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    try {
      await adminClient.from('audit_log').insert({
        user_id: user.id,
        user_email: user.email ?? profile?.email ?? null,
        user_role: profile.role,
        action_type: role !== undefined ? 'permission_change' : 'update',
        table_name: 'profiles',
        record_id: user_id,
        before_value: beforeProfile ? { role: beforeProfile.role, is_active: beforeProfile.is_active } : null,
        after_value: {
          ...updates,
          target_email: beforeProfile?.email ?? null,
          description: role !== undefined
            ? `Updated role to ${String(role)}`
            : `Updated status to ${is_active ? 'Active' : 'Inactive'}`,
        },
        ip_address: request.headers.get('x-forwarded-for') || null,
      })
    } catch {
      // Non-blocking audit log failure
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('update-user error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

