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
        const deptHead = allUsers.find(u =>
            u.user_type === 'department_head' &&
            u.department_id === department_id
        );

        return Response.json({
            dept_head_email: deptHead?.email || null,
            dept_head_name: deptHead?.full_name || null
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});