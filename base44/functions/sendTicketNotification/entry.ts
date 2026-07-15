import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { ticket_id, type, message, send_email } = await req.json();

        if (!ticket_id || !type || !message) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Get ticket details
        const ticket = await base44.asServiceRole.entities.Ticket.get(ticket_id);
        if (!ticket) {
            return Response.json({ error: 'Ticket not found' }, { status: 404 });
        }

        // Determine who to notify
        const notifyEmails = new Set();
        
        // Always notify the ticket submitter
        if (ticket.submitter_email && ticket.submitter_email !== user.email) {
            notifyEmails.add(ticket.submitter_email);
        }
        
        // Notify assigned person if exists
        if (ticket.assigned_to && ticket.assigned_to !== user.email) {
            notifyEmails.add(ticket.assigned_to);
        }
        
        // Notify department heads for this department
        const users = await base44.asServiceRole.entities.User.filter({
            department_id: ticket.department_id,
            user_type: 'department_head'
        });
        
        users.forEach(u => {
            if (u.email !== user.email) {
                notifyEmails.add(u.email);
            }
        });

        // Create in-app notifications
        const notifications = [];
        for (const email of notifyEmails) {
            notifications.push({
                user_email: email,
                ticket_id: ticket.id,
                title: `Ticket #${ticket.id.slice(0, 8)} - ${type}`,
                message: message,
                type: type,
                is_read: false
            });
        }

        if (notifications.length > 0) {
            await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
        }

        // Send email notifications if requested
        if (send_email) {
            for (const email of notifyEmails) {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: email,
                    subject: `Ticket Update: ${ticket.title}`,
                    body: `
                        <h2>${ticket.title}</h2>
                        <p><strong>Update:</strong> ${message}</p>
                        <p><strong>Status:</strong> ${ticket.status}</p>
                        <p><strong>Priority:</strong> ${ticket.priority}</p>
                        <br>
                        <p><a href="${Deno.env.get('BASE44_APP_URL') || 'https://your-app-url.com'}">View Ticket</a></p>
                    `
                });
            }
        }

        return Response.json({ 
            success: true,
            notified_users: Array.from(notifyEmails).length
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});