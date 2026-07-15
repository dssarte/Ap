import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me();
        if (!user || user.user_type !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        const { user_id, verified } = await req.json();
        if (!user_id) {
            return Response.json({ error: 'user_id is required' }, { status: 400 });
        }

        const flag = verified === true || verified === 'true';

        // Update ALL known verification flags so the platform OTP gate is bypassed on login
        await base44.asServiceRole.entities.User.update(user_id, {
            is_verified: flag,
            email_verified: flag,
            verified: flag,
            is_email_verified: flag,
        });

        return Response.json({ success: true, verified: flag });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});