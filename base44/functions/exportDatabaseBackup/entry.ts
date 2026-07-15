import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Complete database backup. Admin-only. Uses ONLY entity reads — no
// Integration credits (no InvokeLLM / GenerateImage / SendEmail / etc.).
// Returns the full dataset as JSON so the caller can save it as a backup file.

const ENTITY_NAMES = [
  'User',
  'Department',
  'Category',
  'Ticket',
  'TicketComment',
  'TicketFeedback',
  'TicketRule',
  'CannedResponse',
  'SLA',
  'Notification',
  'Brand',
  'Store',
  'AuditTemplate',
  'AuditSubmission',
  'AuditAssignment',
  'ChecklistConfig',
  'PendingUser',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const backup = {
      app_id: Deno.env.get('BASE44_APP_ID'),
      exported_at: new Date().toISOString(),
      entity_count: ENTITY_NAMES.length,
      entities: {},
    };

    for (const name of ENTITY_NAMES) {
      try {
        // Max page size is 10000 (platform cap). A single fetch covers this helpdesk's
        // per-entity volume; the record count is reported so a partial export is visible.
        const records = await base44.asServiceRole.entities[name].list('-created_date', 10000);
        const all = Array.isArray(records) ? records : [];
        backup.entities[name] = { count: all.length, records: all, truncated: all.length >= 10000 };
      } catch (e) {
        backup.entities[name] = { count: 0, records: [], __error: e.message };
      }
    }

    const total = Object.values(backup.entities).reduce((sum, e) => sum + (e.count || 0), 0);
    backup.total_records = total;

    return Response.json(backup);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});