import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DEFAULT_ADMIN_EMAIL = 'dennissarte@gmail.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Only process on user creation
    if (event.type !== 'create') {
      return Response.json({ success: true, message: 'Not a create event' });
    }

    // Check if this is the default admin email
    if (data.email === DEFAULT_ADMIN_EMAIL) {
      // Update user to admin
      await base44.asServiceRole.entities.User.update(data.id, {
        user_type: 'admin'
      });

      return Response.json({ 
        success: true, 
        message: `Set ${data.email} as admin` 
      });
    }

    return Response.json({ 
      success: true, 
      message: 'Not default admin email' 
    });
  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});