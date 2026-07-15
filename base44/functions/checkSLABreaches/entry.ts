import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This function should be called by automation without user context
    const now = new Date();
    
    // Get all active tickets that aren't closed
    const tickets = await base44.asServiceRole.entities.Ticket.filter({
      status: { $ne: 'closed' }
    });

    const updates = [];
    const notifications = [];

    for (const ticket of tickets) {
      if (!ticket.sla_response_due && !ticket.sla_resolution_due) continue;

      let needsUpdate = false;
      const updateData = {};

      // Check response SLA breach
      if (!ticket.first_response_at && ticket.sla_response_due) {
        const responseDue = new Date(ticket.sla_response_due);
        if (now > responseDue && !ticket.sla_response_breached) {
          updateData.sla_response_breached = true;
          needsUpdate = true;
          notifications.push({
            ticket_id: ticket.id,
            type: 'Response SLA Breached',
            message: `Ticket "${ticket.title}" has breached response SLA`
          });
        }
      }

      // Check resolution SLA breach
      if (!ticket.resolved_at && ticket.sla_resolution_due) {
        const resolutionDue = new Date(ticket.sla_resolution_due);
        if (now > resolutionDue && !ticket.sla_resolution_breached) {
          updateData.sla_resolution_breached = true;
          needsUpdate = true;
          notifications.push({
            ticket_id: ticket.id,
            type: 'Resolution SLA Breached',
            message: `Ticket "${ticket.title}" has breached resolution SLA`
          });
        }
      }

      // Check for escalation
      if (ticket.sla_id && !ticket.escalated) {
        const sla = await base44.asServiceRole.entities.SLA.get(ticket.sla_id);
        if (sla && sla.escalate_after_hours) {
          const createdDate = new Date(ticket.created_date);
          const hoursOpen = (now - createdDate) / (1000 * 60 * 60);
          
          if (hoursOpen >= sla.escalate_after_hours) {
            updateData.escalated = true;
            updateData.escalated_at = now.toISOString();
            needsUpdate = true;
            
            // Send escalation notification
            if (sla.escalation_email) {
              await base44.asServiceRole.integrations.Core.SendEmail({
                to: sla.escalation_email,
                subject: `🚨 Escalation: ${ticket.title}`,
                body: `Ticket #${ticket.id} has been escalated due to SLA policy.\n\nTitle: ${ticket.title}\nPriority: ${ticket.priority}\nOpen for: ${hoursOpen.toFixed(1)} hours\nAssigned to: ${ticket.assigned_to || 'Unassigned'}`
              });
            }

            notifications.push({
              ticket_id: ticket.id,
              type: 'Escalated',
              message: `Ticket "${ticket.title}" has been escalated`
            });
          }
        }
      }

      if (needsUpdate) {
        await base44.asServiceRole.entities.Ticket.update(ticket.id, updateData);
        updates.push(ticket.id);
      }
    }

    // Create notifications for breaches
    for (const notif of notifications) {
      const ticket = tickets.find(t => t.id === notif.ticket_id);
      if (ticket && ticket.assigned_to) {
        await base44.asServiceRole.entities.Notification.create({
          user_email: ticket.assigned_to,
          ticket_id: ticket.id,
          title: notif.type,
          message: notif.message,
          type: 'updated'
        });
      }
    }

    return Response.json({
      success: true,
      checked: tickets.length,
      updated: updates.length,
      breaches: notifications.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});