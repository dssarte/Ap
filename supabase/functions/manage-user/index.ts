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
    const { data: callerProfiles, error: callerProfileError } = await adminClient
      .from('users')
      .select('id,user_type,disabled')
      .ilike('email', callerEmail)
      .limit(1)
    if (callerProfileError) throw callerProfileError

    const callerProfile = callerProfiles?.[0]
    if (!callerProfile || callerProfile.user_type !== 'admin' || callerProfile.disabled === true) {
      return jsonResponse({ error: 'Only an active administrator can manage users.' }, 403)
    }

    const body = await request.json()
    const action = String(body.action ?? '')
    const targetId = String(body.user_id ?? '')
    if (!['set_enabled', 'delete'].includes(action) || !targetId) {
      return jsonResponse({ error: 'A valid user and action are required.' }, 400)
    }

    const { data: target, error: targetError } = await adminClient
      .from('users')
      .select('id,email,user_type,disabled')
      .eq('id', targetId)
      .maybeSingle()
    if (targetError) throw targetError
    if (!target) return jsonResponse({ error: 'User profile not found.' }, 404)

    const targetEmail = String(target.email ?? '').trim().toLowerCase()
    if (targetEmail === callerEmail) {
      return jsonResponse({ error: 'You cannot disable or remove your own administrator account.' }, 400)
    }

    const willDisable = action === 'delete' || body.enabled !== true
    if (target.user_type === 'admin' && willDisable) {
      const { count, error: countError } = await adminClient
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('user_type', 'admin')
        .or('disabled.eq.false,disabled.is.null')
      if (countError) throw countError
      if ((count ?? 0) <= 1) {
        return jsonResponse({ error: 'The last active administrator cannot be disabled or removed.' }, 400)
      }
    }

    const { data: authPage, error: authListError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (authListError) throw authListError
    const authUser = authPage.users.find((user) => user.email?.trim().toLowerCase() === targetEmail)

    if (action === 'set_enabled') {
      const enabled = body.enabled === true
      const previousDisabled = target.disabled === true
      const now = new Date().toISOString()
      const { data: updatedProfile, error: updateError } = await adminClient
        .from('users')
        .update({
          disabled: !enabled,
          disabled_reason: enabled ? null : String(body.reason ?? 'Disabled from Admin > Users'),
          updated_date: now,
        })
        .eq('id', target.id)
        .select()
        .single()
      if (updateError) throw updateError

      if (authUser) {
        const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(authUser.id, {
          ban_duration: enabled ? 'none' : '876000h',
        })
        if (authUpdateError) {
          await adminClient.from('users').update({ disabled: previousDisabled, updated_date: now }).eq('id', target.id)
          throw authUpdateError
        }
      }

      return jsonResponse({ success: true, profile: updatedProfile, enabled })
    }

    // Remove Auth first so a partially failed cleanup can never leave a login
    // account that recreates its profile. Historical tickets/audits are retained.
    if (authUser) {
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(authUser.id, false)
      if (authDeleteError) throw authDeleteError
    }
    const { error: profileDeleteError } = await adminClient.from('users').delete().eq('id', target.id)
    if (profileDeleteError) throw profileDeleteError
    await adminClient.from('pending_users').delete().ilike('email', targetEmail)

    return jsonResponse({ success: true, deleted: true, email: targetEmail })
  } catch (error) {
    console.error('manage-user failed', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unable to manage the user.' }, 500)
  }
})
