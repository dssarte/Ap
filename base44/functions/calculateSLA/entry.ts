import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticket_id, priority, department_id } = await req.json();

    // Find applicable SLA policy
    const slas = await base44.asServiceRole.entities.SLA.filter({ 
      is_active: true,
      priority: priority
    });

    // Prefer department-specific SLA, fallback to general
    let applicableSLA = slas.find(s => s.department_id === department_id);
    if (!applicableSLA) {
      applicableSLA = slas.find(s => !s.department_id);
    }

    if (!applicableSLA) {
      console.log('No SLA policy found for priority:', priority, 'department:', department_id);
      return Response.json({ success: false, message: 'No SLA policy found - ticket approved without SLA' });
    }

    const now = new Date();
    const responseDue = new Date(now.getTime() + applicableSLA.response_time_hours * 60 * 60 * 1000);
    const resolutionDue = new Date(now.getTime() + applicableSLA.resolution_time_hours * 60 * 60 * 1000);

    try {
      // Update ticket with SLA info
      await base44.asServiceRole.entities.Ticket.update(ticket_id, {
        sla_id: applicableSLA.id,
        sla_response_due: responseDue.toISOString(),
        sla_resolution_due: resolutionDue.toISOString()
      });
      console.log('SLA applied to ticket:', ticket_id);
    } catch (updateErr) {
      console.warn('Failed to update ticket with SLA:', updateErr.message);
    }

    return Response.json({
      success: true,
      sla: {
        id: applicableSLA.id,
        name: applicableSLA.name,
        response_due: responseDue.toISOString(),
        resolution_due: resolutionDue.toISOString()
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});