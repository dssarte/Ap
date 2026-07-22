import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
)

const allowedUserTypes = new Set(['user', 'approver', 'department_head', 'store_manager', 'admin'])
const allowedRoles = new Set(['user', 'admin'])

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const publicKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? ''
    const authorization = request.headers.get('Authorization') ?? ''

    if (!supabaseUrl || !publicKey || !serviceKey) {
      return jsonResponse({ error: 'The user-management service is not configured.' }, 500)
    }
    if (!authorization.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authentication required.' }, 401)
    }

    // Validate the caller's signed-in session before using any privileged API.
    const callerClient = createClient(supabaseUrl, publicKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: callerData, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !callerData.user?.email) {
      return jsonResponse({ error: 'Your session is invalid or expired. Sign in again.' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const callerEmail = callerData.user.email.trim().toLowerCase()
    const { data: callerProfiles, error: profileLookupError } = await adminClient
      .from('users')
      .select('id,user_type,disabled')
      .ilike('email', callerEmail)
      .limit(1)

    if (profileLookupError) throw profileLookupError
    const callerProfile = callerProfiles?.[0]
    if (!callerProfile || callerProfile.user_type !== 'admin' || callerProfile.disabled === true) {
      return jsonResponse({ error: 'Only an active administrator can create users.' }, 403)
    }

    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const fullName = String(body.full_name ?? '').trim() || email
    const userType = allowedUserTypes.has(body.user_type) ? body.user_type : 'user'
    const requestedRole = allowedRoles.has(body.role) ? body.role : 'user'
    const role = userType === 'admin' ? 'admin' : requestedRole
    const enabled = body.enabled !== false

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return jsonResponse({ error: 'A valid email address is required.' }, 400)
    }
    if (password.length < 6) {
      return jsonResponse({ error: 'Password must contain at least 6 characters.' }, 400)
    }

    const { data: existingProfiles, error: existingProfileError } = await adminClient
      .from('users')
      .select('id,disabled')
      .ilike('email', email)
      .limit(1)
    if (existingProfileError) throw existingProfileError

    // createUser is an admin API and does not send a confirmation email, so it
    // is not subject to the public email signup limit. The supplied email is
    // confirmed because an administrator entered and approved the account.
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (authError) {
      const duplicate = /already|registered|exists/i.test(authError.message ?? '')
      return jsonResponse({
        error: duplicate
          ? 'An authentication account already exists for this email. Edit or re-enable its existing user profile instead.'
          : authError.message,
      }, duplicate ? 409 : 400)
    }

    if (!enabled) {
      const { error: banError } = await adminClient.auth.admin.updateUserById(authData.user.id, {
        ban_duration: '876000h',
      })
      if (banError) {
        await adminClient.auth.admin.deleteUser(authData.user.id)
        throw banError
      }
    }

    const now = new Date().toISOString()
    const assignedStores = Array.isArray(body.assigned_stores)
      ? body.assigned_stores.filter((store: unknown) => typeof store === 'string' && store.trim()).map((store: string) => store.trim())
      : []
    const profilePayload = {
      email,
      full_name: fullName,
      display_name: fullName,
      user_type: userType,
      role,
      app_role: role,
      department_id: body.department_id || null,
      department_name: body.department_name || null,
      brand_id: userType === 'store_manager' ? null : (body.brand_id || null),
      store_name: userType === 'store_manager' ? null : (body.store_name || null),
      phone: body.phone || null,
      assigned_stores: userType === 'store_manager' ? assignedStores : [],
      is_verified: true,
      verified: true,
      email_verified: true,
      disabled: !enabled,
      disabled_reason: enabled ? null : 'Created as disabled from Admin > Users',
      updated_date: now,
    }

    let profileResult
    if (existingProfiles?.[0]?.id) {
      profileResult = await adminClient
        .from('users')
        .update(profilePayload)
        .eq('id', existingProfiles[0].id)
        .select()
        .single()
    } else {
      profileResult = await adminClient
        .from('users')
        .insert({ id: authData.user.id, created_date: now, ...profilePayload })
        .select()
        .single()
    }

    if (profileResult.error) {
      // Avoid leaving a login account without an application profile.
      await adminClient.auth.admin.deleteUser(authData.user.id)
      throw profileResult.error
    }

    await adminClient.from('pending_users').delete().ilike('email', email)
    return jsonResponse({ success: true, profile: profileResult.data, auth_user_id: authData.user.id, enabled })
  } catch (error) {
    console.error('initialize-new-user failed', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unable to create the user.' }, 500)
  }
})
