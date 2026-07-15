import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const { email, password } = await req.json();
        if (!email || !password) {
            return Response.json({ error: 'email and password are required' }, { status: 400 });
        }

        const pendingUsers = await base44.asServiceRole.entities.PendingUser.filter({ email });
        const pending = pendingUsers[0];

        if (!pending) {
            // Not an admin-created pending account — let the frontend fall back to a normal login
            return Response.json({ isPending: false });
        }

        // Whatever password is entered here becomes the account's real password —
        // this is the user's first login, so we don't require it to match the admin-set one.
        // Register the real account now — this is the moment the OTP email gets sent
        await base44.auth.register({ email, password, full_name: pending.full_name || email });

        // Find the newly created user record and apply the profile fields set by the admin
        let newUser = null;
        for (let i = 0; i < 5; i++) {
            const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 50);
            newUser = allUsers.find((u) => u.email === email) || null;
            if (newUser) break;
            await new Promise((r) => setTimeout(r, 1500));
        }

        if (newUser) {
            await base44.asServiceRole.entities.User.update(newUser.id, {
                role: pending.user_type === 'admin' ? 'admin' : 'user',
                user_type: pending.user_type || 'user',
                display_name: pending.full_name?.trim() || null,
                department_id: pending.department_id || null,
                department_name: pending.department_name || null,
                store_name: pending.store_name || null,
                assigned_stores: pending.assigned_stores || [],
                phone: pending.phone || null,
            });
        }

        await base44.asServiceRole.entities.PendingUser.delete(pending.id);

        return Response.json({ isPending: true, success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});