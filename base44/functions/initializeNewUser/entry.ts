import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me();
        if (!user || user.user_type !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        const body = await req.json();

        // Legacy: if only user_id passed, just set default user_type
        if (body.user_id && !body.email) {
            await base44.asServiceRole.entities.User.update(body.user_id, { user_type: 'user' });
            return Response.json({ success: true, message: 'User initialized successfully' });
        }

        const { email, password, full_name, user_type, department_id, department_name, store_name, phone, assigned_stores } = body;

        if (!email || !password) {
            return Response.json({ error: 'email and password are required' }, { status: 400 });
        }

        // Don't allow duplicating a real, already-registered account
        const existingUsers = await base44.asServiceRole.entities.User.filter({ email });
        if (existingUsers[0]) {
            return Response.json({ error: 'A user with this email already exists' }, { status: 400 });
        }

        // Don't allow duplicating a pending account
        const existingPending = await base44.asServiceRole.entities.PendingUser.filter({ email });
        if (existingPending[0]) {
            return Response.json({ error: 'A pending user with this email already exists' }, { status: 400 });
        }

        // Store as pending only — no account is registered and no OTP email is sent
        // until this user enters their email and password on the login page for the first time.
        const pending = await base44.asServiceRole.entities.PendingUser.create({
            email,
            password,
            full_name: full_name || null,
            user_type: user_type || 'user',
            department_id: department_id || null,
            department_name: department_name || null,
            store_name: store_name || null,
            assigned_stores: assigned_stores || [],
            phone: phone || null,
        });

        return Response.json({ success: true, pendingId: pending.id });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});