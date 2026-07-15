import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

const entityTables = {
  User: 'users', Brand: 'brands', Store: 'stores', Department: 'departments',
  Category: 'categories', SLA: 'slas', CannedResponse: 'canned_responses',
  TicketRule: 'ticket_rules', PendingUser: 'pending_users', ChecklistConfig: 'checklist_configs',
  AuditTemplate: 'audit_templates', AuditAssignment: 'audit_assignments', Ticket: 'tickets',
  TicketComment: 'ticket_comments', TicketFeedback: 'ticket_feedback', Notification: 'notifications',
  AuditSubmission: 'audit_submissions',
};

const unwrap = ({ data, error }) => { if (error) throw error; return data; };
const cleanPayload = (payload = {}) => Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
const applySort = (query, sort) => !sort ? query : query.order(sort.startsWith('-') ? sort.slice(1) : sort, { ascending: !sort.startsWith('-'), nullsFirst: false });
const applyFilters = (query, filters = {}) => {
  for (const [key, value] of Object.entries(filters || {})) {
    if (value === undefined) continue;
    if (value === null) query = query.is(key, null);
    else if (Array.isArray(value)) query = value.length ? query.in(key, value) : query.eq(key, '__no_match__');
    else query = query.eq(key, value);
  }
  return query;
};

function entityApi(name) {
  const table = entityTables[name];
  if (!table) throw new Error(`Unknown entity: ${String(name)}`);
  return {
    async list(sort, limit = 1000) {
      let q = supabase.from(table).select('*');
      q = applySort(q, sort).limit(limit);
      return (unwrap(await q) || []);
    },
    async filter(filters, sort, limit = 1000) {
      let q = applyFilters(supabase.from(table).select('*'), filters);
      q = applySort(q, sort).limit(limit);
      return (unwrap(await q) || []);
    },
    async get(id) {
      if (!id) return null;
      const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
    async create(payload) {
      const now = new Date().toISOString();
      const row = cleanPayload({ ...payload, id: payload?.id || crypto.randomUUID(), created_date: payload?.created_date || now, updated_date: now });
      return unwrap(await supabase.from(table).insert(row).select().single());
    },
    async update(id, payload) {
      return unwrap(await supabase.from(table).update(cleanPayload({ ...payload, updated_date: new Date().toISOString() })).eq('id', id).select().single());
    },
    async delete(id) { return unwrap(await supabase.from(table).delete().eq('id', id).select()); },
    async bulkUpdate(itemsOrIds, payload) {
      if (!Array.isArray(itemsOrIds) || itemsOrIds.length === 0) return [];

      // Supports both bulkUpdate([id1, id2], payload) and
      // bulkUpdate([{ id, ...changes }, ...]) used by the admin screens.
      if (typeof itemsOrIds[0] === 'object' && itemsOrIds[0] !== null) {
        const results = [];
        for (const item of itemsOrIds) {
          const { id, ...changes } = item;
          if (!id) continue;
          const updated = unwrap(await supabase
            .from(table)
            .update(cleanPayload({ ...changes, updated_date: new Date().toISOString() }))
            .eq('id', id)
            .select()
            .single());
          results.push(updated);
        }
        return results;
      }

      return unwrap(await supabase
        .from(table)
        .update(cleanPayload({ ...payload, updated_date: new Date().toISOString() }))
        .in('id', itemsOrIds)
        .select());
    },
    subscribe(callback) {
      const channel = supabase.channel(`${table}-${crypto.randomUUID()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, payload => callback({ ...payload, data: payload.new || payload.old }))
        .subscribe();
      return () => supabase.removeChannel(channel);
    },
  };
}

const entities = new Proxy({}, { get: (_, name) => entityApi(name) });

async function currentProfile() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw error || new Error('Authentication required');
  const email = user.email?.trim().toLowerCase();
  const { data: profiles, error: profileError } = await supabase.from('users').select('*').ilike('email', email).limit(1);
  if (profileError) throw profileError;
  let profile = profiles?.[0] || null;
  if (!profile) {
    const now = new Date().toISOString();
    const payload = {
      id: crypto.randomUUID(), email, full_name: user.user_metadata?.full_name || email,
      display_name: user.user_metadata?.full_name || email, role: 'user', app_role: 'user',
      user_type: 'user', is_verified: true, verified: true, email_verified: true,
      created_date: now, updated_date: now,
    };
    profile = unwrap(await supabase.from('users').insert(payload).select().single());
  }
  if (profile.disabled === true || String(profile.disabled).toLowerCase() === 'true') {
    await supabase.auth.signOut();
    throw new Error('This account has been disabled by an administrator.');
  }
  return { ...profile, email: profile.email?.trim().toLowerCase(), assigned_stores: Array.isArray(profile.assigned_stores) ? profile.assigned_stores : [] };
}

const auth = {
  me: currentProfile,
  async isAuthenticated() { const { data } = await supabase.auth.getSession(); return Boolean(data.session); },
  async loginViaEmailPassword(email, password) { return unwrap(await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })); },
  async signUp({ email, password, full_name }) { return unwrap(await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { full_name } } })); },
  async logout(redirect = true) { await supabase.auth.signOut(); if (redirect) window.location.replace('/login'); },
  redirectToLogin() { window.location.replace('/login'); },
  async updateMe(payload) { const me = await currentProfile(); return unwrap(await supabase.from('users').update(cleanPayload({ ...payload, updated_date: new Date().toISOString() })).eq('id', me.id).select().single()); },
  async resetPasswordRequest(email) { return unwrap(await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reset-password` })); },
  async resetPassword({ newPassword }) { return unwrap(await supabase.auth.updateUser({ password: newPassword })); },
  async resendOtp(email) { return unwrap(await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() })); },
  async verifyOtp({ email, otpCode }) { const data = unwrap(await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: otpCode, type: 'signup' })); return { access_token: data.session?.access_token, ...data }; },
  setToken() {},
};

async function findApprover(departmentId) {
  if (!departmentId) return { approver_email: '', approver_name: '' };
  const { data, error } = await supabase.from('users').select('email,full_name,display_name,user_type').eq('department_id', departmentId).in('user_type', ['approver','department_head','admin']).limit(1).maybeSingle();
  if (error) throw error;
  return { approver_email: data?.email || '', approver_name: data?.full_name || data?.display_name || '' };
}

const functions = {
  async invoke(name, body = {}) {
    if (name === 'completeFirstLogin') return { data: { isPending: false } };

    if (name === 'initializeNewUser') {
      const email = body.email?.trim().toLowerCase();
      const password = body.password;
      if (!email) throw new Error('Email is required.');
      if (!password || password.length < 6) throw new Error('Password must contain at least 6 characters.');

      // Use an isolated auth client so creating another user never replaces the
      // currently logged-in administrator session.
      const adminSignupClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
      );

      const { data: signupData, error: signupError } = await adminSignupClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: body.full_name || email } },
      });

      // Supabase returns an error when the auth account already exists. In that
      // case we still save/update the application profile so it appears in Users.
      const alreadyExists = signupError && /already|registered|exists/i.test(signupError.message || '');
      if (signupError && !alreadyExists) throw signupError;

      const now = new Date().toISOString();
      const profilePayload = cleanPayload({
        email,
        full_name: body.full_name?.trim() || email,
        display_name: body.full_name?.trim() || email,
        user_type: body.user_type || 'user',
        role: body.role || (body.user_type === 'admin' ? 'admin' : 'user'),
        app_role: body.role || (body.user_type === 'admin' ? 'admin' : 'user'),
        department_id: body.department_id || null,
        department_name: body.department_name || null,
        brand_id: body.brand_id || null,
        store_name: body.store_name || null,
        phone: body.phone || null,
        assigned_stores: Array.isArray(body.assigned_stores) ? body.assigned_stores : [],
        is_verified: Boolean(signupData?.user?.email_confirmed_at),
        verified: Boolean(signupData?.user?.email_confirmed_at),
        email_verified: Boolean(signupData?.user?.email_confirmed_at),
        disabled: false,
        updated_date: now,
      });

      const { data: existingProfiles, error: lookupError } = await supabase
        .from('users')
        .select('id')
        .ilike('email', email)
        .limit(1);
      if (lookupError) throw lookupError;

      let profile;
      if (existingProfiles?.[0]?.id) {
        profile = unwrap(await supabase
          .from('users')
          .update(profilePayload)
          .eq('id', existingProfiles[0].id)
          .select()
          .single());
      } else {
        profile = unwrap(await supabase
          .from('users')
          .insert({ id: crypto.randomUUID(), created_date: now, ...profilePayload })
          .select()
          .single());
      }

      // Remove any stale pending row for the same email.
      await supabase.from('pending_users').delete().ilike('email', email);
      return { data: { success: true, profile, auth_user_id: signupData?.user?.id || null, already_exists: Boolean(alreadyExists) } };
    }

    if (name === 'setUserVerified') {
      const verified = Boolean(body.verified);
      const profile = unwrap(await supabase
        .from('users')
        .update({ is_verified: verified, verified, email_verified: verified, updated_date: new Date().toISOString() })
        .eq('id', body.user_id)
        .select()
        .single());
      return { data: { success: true, profile } };
    }

    if (name === 'findApproverForDepartment') return { data: await findApprover(body.department_id) };
    if (name === 'findDepartmentHead') {
      const found = await findApprover(body.department_id);
      return { data: { dept_head_email: found.approver_email || null, dept_head_name: found.approver_name || null } };
    }

    if (name === 'calculateSLA') {
      const ticketId = body.ticket_id;
      if (!ticketId) throw new Error('ticket_id is required');
      const ticket = unwrap(await supabase.from('tickets').select('*').eq('id', ticketId).single());
      let q = supabase.from('slas').select('*').eq('is_active', true).eq('priority', ticket.priority || 'medium');
      const { data: policies, error: slaError } = await q.order('created_date', { ascending: false });
      if (slaError) throw slaError;
      const policy = (policies || []).find(x => !x.department_id || x.department_id === ticket.handling_department_id || x.department_id === ticket.department_id) || policies?.[0];
      if (!policy) return { data: { success: true, applied: false } };
      const start = new Date(ticket.approved_at || ticket.created_date || Date.now());
      const responseDue = new Date(start.getTime() + Number(policy.response_time_hours || 0) * 3600000).toISOString();
      const resolutionDue = new Date(start.getTime() + Number(policy.resolution_time_hours || 0) * 3600000).toISOString();
      const updated = unwrap(await supabase.from('tickets').update({
        sla_id: policy.id,
        sla_response_due: responseDue,
        sla_resolution_due: resolutionDue,
        sla_response_breached: false,
        sla_resolution_breached: false,
        updated_date: new Date().toISOString(),
      }).eq('id', ticketId).select().single());
      return { data: { success: true, applied: true, ticket: updated } };
    }

    if (name === 'sendTicketNotification') {
      const ticketId = body.ticket_id;
      if (!ticketId) throw new Error('ticket_id is required');
      const ticket = unwrap(await supabase.from('tickets').select('*').eq('id', ticketId).single());
      const recipients = new Set([ticket.submitter_email, ticket.assigned_to, ticket.approver_email].filter(Boolean).map(x => x.trim().toLowerCase()));
      if (ticket.handling_department_id || ticket.department_id) {
        const deptId = ticket.handling_department_id || ticket.department_id;
        const { data: staff } = await supabase.from('users').select('email').eq('department_id', deptId).in('user_type', ['admin','department_head','staff']);
        (staff || []).forEach(x => x.email && recipients.add(x.email.trim().toLowerCase()));
      }
      const now = new Date().toISOString();
      const rows = [...recipients].map(email => ({
        id: crypto.randomUUID(), created_date: now, updated_date: now,
        user_email: email, ticket_id: ticketId, type: body.type || 'updated',
        title: `Ticket #${String(ticketId).slice(0,8)} - ${body.type || 'updated'}`,
        message: body.message || `Ticket ${ticket.title} was updated`,
        link: `/ticket/${ticketId}`, is_read: false, is_sample: false,
      }));
      if (rows.length) unwrap(await supabase.from('notifications').insert(rows));
      return { data: { success: true, recipients: rows.length } };
    }

    if (name === 'applyTicketRules') {
      const ticketId = body.ticket_id;
      if (!ticketId) throw new Error('ticket_id is required');
      const ticket = unwrap(await supabase.from('tickets').select('*').eq('id', ticketId).single());
      const { data: rules, error: rulesError } = await supabase.from('ticket_rules').select('*').eq('is_active', true).order('order', { ascending: true });
      if (rulesError) throw rulesError;
      const changes = {};
      for (const rule of rules || []) {
        const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
        const matches = conditions.every(c => {
          const actual = ticket[c.field];
          if (c.operator === 'equals' || !c.operator) return String(actual ?? '') === String(c.value ?? '');
          if (c.operator === 'contains') return String(actual ?? '').toLowerCase().includes(String(c.value ?? '').toLowerCase());
          if (c.operator === 'not_equals') return String(actual ?? '') !== String(c.value ?? '');
          return true;
        });
        if (!matches) continue;
        for (const action of (Array.isArray(rule.actions) ? rule.actions : [])) {
          if (action.field) changes[action.field] = action.value;
          if (action.type === 'assign' && action.email) changes.assigned_to = action.email;
          if (action.type === 'priority' && action.value) changes.priority = action.value;
          if (action.type === 'status' && action.value) changes.status = action.value;
        }
      }
      if (Object.keys(changes).length) {
        unwrap(await supabase.from('tickets').update({ ...changes, updated_date: new Date().toISOString() }).eq('id', ticketId));
      }
      return { data: { success: true, applied: Object.keys(changes).length > 0, changes } };
    }
    if (['exportDatabaseBackup','exportDatabaseSql','generatePresentation','generateUserManualPDF'].includes(name)) {
      return { data: { success: false, local: true, message: `${name} requires a Supabase Edge Function.` } };
    }
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) throw error;
    return { data };
  },
};

const integrations = { Core: {
  async UploadFile({ file }) {
    if (!file) throw new Error('No file selected');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${safeName}`;
    unwrap(await supabase.storage.from('attachments').upload(path, file, { upsert: false }));
    const { data } = supabase.storage.from('attachments').getPublicUrl(path);
    return { file_url: data.publicUrl };
  },
  async SendEmail(payload) { return functions.invoke('send-email', payload); },
}};

export const base44 = { entities, auth, functions, integrations, appLogs: { logUserInApp: async () => true } };
