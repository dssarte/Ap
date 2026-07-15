import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    // Clone request so we can read body AND pass original to SDK
    const cloned = req.clone();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.user_type !== 'admin' && user.role !== 'admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { userId, full_name } = await cloned.json();

    if (!userId || !full_name) {
      return Response.json({ error: 'userId and full_name are required' }, { status: 400 });
    }

    await base44.asServiceRole.entities.User.update(userId, { full_name });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});