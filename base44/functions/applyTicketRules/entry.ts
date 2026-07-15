import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ticket_id } = await req.json();
    if (!ticket_id) return Response.json({ error: 'ticket_id required' }, { status: 400 });

    // Fetch ticket and rules
    const [ticket, rules] = await Promise.all([
      base44.entities.Ticket.filter({ id: ticket_id }),
      base44.entities.TicketRule.list('order', 200),
    ]);

    const t = Array.isArray(ticket) ? ticket[0] : ticket;
    if (!t) return Response.json({ error: 'Ticket not found' }, { status: 404 });

    const activeRules = rules.filter(r => r.is_active);
    const appliedRules = [];
    const updates = {};

    for (const rule of activeRules) {
      const conditions = rule.conditions || [];
      const allMatch = conditions.every(cond => {
        const fieldVal = (t[cond.field] || '').toString().toLowerCase();
        const condVal = (cond.value || '').toLowerCase();
        switch (cond.operator) {
          case 'equals': return fieldVal === condVal;
          case 'not_equals': return fieldVal !== condVal;
          case 'contains': return fieldVal.includes(condVal);
          case 'starts_with': return fieldVal.startsWith(condVal);
          case 'is_empty': return !fieldVal;
          case 'is_not_empty': return !!fieldVal;
          default: return false;
        }
      });

      if (!allMatch) continue;

      for (const action of (rule.actions || [])) {
        switch (action.type) {
          case 'set_priority':
            updates.priority = action.value;
            break;
          case 'set_status':
            updates.status = action.value;
            break;
          case 'assign_department':
            updates.department_id = action.value;
            updates.department_name = action.label || action.value;
            break;
          case 'assign_to':
            updates.assigned_to = action.value;
            break;
          case 'escalate':
            updates.escalated = true;
            updates.escalated_at = new Date().toISOString();
            break;
          case 'add_tag':
            // tags stored as comma separated in a notes/tag field if needed
            break;
        }
      }

      appliedRules.push(rule.name);
    }

    if (Object.keys(updates).length > 0) {
      await base44.entities.Ticket.update(ticket_id, updates);
    }

    return Response.json({ applied_rules: appliedRules, updates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});