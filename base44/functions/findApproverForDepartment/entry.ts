import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { department_id } = await req.json();

        const allUsers = await base44.asServiceRole.entities.User.list();
        const approver = allUsers.find(u =>
            u.user_type === 'approver' &&
            u.department_id === department_id
        );

        return Response.json({
            approver_email: approver?.email || '',
            approver_name: approver?.full_name || ''
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});