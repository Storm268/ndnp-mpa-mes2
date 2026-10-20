import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, full_name, phone } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, data: null, message: 'Valid email is required.' },
        { status: 400 }
      )
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { success: false, data: null, message: 'Password must be at least 8 characters.' },
        { status: 400 }
      )
    }

    const cleanEmail = email.toLowerCase().trim()
    const cleanFullName = typeof full_name === 'string' ? full_name.trim() : null
    const cleanPhone = typeof phone === 'string' ? phone.trim() : null

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json(
        { success: false, data: null, message: 'Server configuration error: Supabase credentials missing.' },
        { status: 500 }
      )
    }

    const adminClient = createSupabaseAdmin(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 1. Create the user in Supabase Auth with default 'citizen' role metadata
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true, // Auto-confirm email so citizen can log in immediately
      user_metadata: {
        full_name: cleanFullName,
        role: 'citizen',
        phone: cleanPhone,
      },
    })

    if (authError) {
      // Check for user already exists
      if (authError.message?.toLowerCase().includes('already') || authError.message?.toLowerCase().includes('registered')) {
        return NextResponse.json(
          { success: false, data: null, message: 'An account with this email address already exists. Please sign in instead.' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { success: false, data: null, message: authError.message },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    // 2. Trigger INSERT to save the new user record to Supabase profiles table
    // Automatically assign the default role/login type of 'citizen'
    const { data: newProfile, error: profileError } = await adminClient
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: cleanEmail,
          full_name: cleanFullName,
          phone: cleanPhone,
          role: 'citizen', // Default citizen role
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select('id, email, full_name, role, is_active')
      .single()

    if (profileError) {
      console.error('[Register API] Error inserting profile to Supabase:', profileError)
      return NextResponse.json(
        { success: false, data: null, message: `Account created but failed to save profile: ${profileError.message}` },
        { status: 500 }
      )
    }

    // 3. Optional: Write audit log entry for citizen registration
    try {
      await adminClient.from('audit_log').insert({
        user_id: userId,
        action: 'citizen.register',
        table_name: 'profiles',
        record_id: userId,
        new_data: { email: cleanEmail, role: 'citizen', full_name: cleanFullName },
        ip_address: request.headers.get('x-forwarded-for') || null,
      })
    } catch {
      // Non-blocking if audit_log is unavailable
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: userId,
            email: cleanEmail,
            full_name: cleanFullName,
            role: 'citizen',
          },
          profile: newProfile,
        },
        message: 'Citizen user registered and saved to Supabase successfully.',
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[Register API] Unexpected error:', err)
    return NextResponse.json(
      { success: false, data: null, message: msg },
      { status: 500 }
    )
  }
}
