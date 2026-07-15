import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Exports the full dataset as PostgreSQL-compatible SQL (CREATE TABLE + INSERT).
// Admin-only. Uses only entity reads — no integration credits.
// Returns text/plain so the browser can save it as a .sql file.

// Ordered so parents are inserted before children (FK constraints satisfied).
const ENTITY_TABLES = [
  ['User', 'users'],
  ['Brand', 'brands'],
  ['Store', 'stores'],
  ['Department', 'departments'],
  ['Category', 'categories'],
  ['SLA', 'slas'],
  ['CannedResponse', 'canned_responses'],
  ['TicketRule', 'ticket_rules'],
  ['PendingUser', 'pending_users'],
  ['ChecklistConfig', 'checklist_configs'],
  ['AuditTemplate', 'audit_templates'],
  ['AuditAssignment', 'audit_assignments'],
  ['Ticket', 'tickets'],
  ['TicketComment', 'ticket_comments'],
  ['TicketFeedback', 'ticket_feedback'],
  ['Notification', 'notifications'],
  ['AuditSubmission', 'audit_submissions'],
];

// column -> referenced table (FK constraints)
const FK_COLUMNS = {
  'created_by_id': 'users',
  'department_id': 'departments',
  'handling_department_id': 'departments',
  'category_id': 'categories',
  'brand_id': 'brands',
  'store_id': 'stores',
  'template_id': 'audit_templates',
  'ticket_id': 'tickets',
  'sla_id': 'slas',
};

const BUILTINS = ['id', 'created_date', 'updated_date', 'created_by_id'];

function snakeCase(s) {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function sqlIdent(name) {
  // reserved / normalized column names — quote defensively
  return `"${name.replace(/"/g, '""')}"`;
}

function sqlText(val) {
  if (val === null || val === undefined) return 'NULL';
  const s = String(val);
  return `'${s.replace(/'/g, "''")}'`;
}

function isoTimestamp(val) {
  if (!val) return 'NULL';
  // Base44 entity timestamps come back without a trailing Z; normalize to UTC ISO 8601.
  if (typeof val === 'string') {
    if (/Z$|[+-]\d{2}:?\d{2}$/.test(val)) return `'${val}'::timestamptz`;
    return `'${val}Z'::timestamptz`;
  }
  try {
    return `'${new Date(val).toISOString()}'::timestamptz`;
  } catch (_e) {
    return 'NULL';
  }
}

function sqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  if (val instanceof Date) return isoTimestamp(val);
  if (typeof val === 'object') {
    // arrays + objects -> jsonb
    const json = JSON.stringify(val);
    return `'${json.replace(/'/g, "''")}'::jsonb`;
  }
  if (typeof val === 'string') {
    // iso-8601-ish date fields -> timestamptz
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) return isoTimestamp(val);
    return sqlText(val);
  }
  return sqlText(val);
}

function inferColumnType(col, values) {
  if (col === 'id' || col === 'created_by_id' || /_id$/.test(col)) return 'UUID';
  if (col === 'created_date' || col === 'updated_date' || /_date$/.test(col) || /_at$/.test(col) || /_due$/.test(col)) return 'TIMESTAMPTZ';
  for (const v of values) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'boolean') return 'BOOLEAN';
    if (typeof v === 'number') return Number.isInteger(v) ? 'INTEGER' : 'NUMERIC';
    if (typeof v === 'object') return 'JSONB';
  }
  return 'TEXT';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const lines = [];
    lines.push(`-- HelpDesk Pro — PostgreSQL export`);
    lines.push(`-- Generated: ${new Date().toISOString()}`);
    lines.push(`-- Target: Supabase / PostgreSQL`);
    lines.push(`-- Replaces existing data on re-import (ON CONFLICT DO UPDATE not included; drop tables first for a clean import).`);
    lines.push('BEGIN;');
    lines.push('');
    lines.push(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()`);
    lines.push('');

    // First pass: collect columns + records per table so CREATE TABLE can be emitted in order.
    const tables = [];
    for (const [entityName, table] of ENTITY_TABLES) {
      let records = [];
      let err = null;
      // Audit answer data is excluded from export — only the table structure is kept.
      if (entityName !== 'AuditSubmission') {
        try {
          const res = await base44.asServiceRole.entities[entityName].list('-created_date', 10000);
          records = Array.isArray(res) ? res : [];
        } catch (e) {
          err = e.message;
        }
      }
      // union of columns across records (built-ins first, then schema order)
      const colSet = new Set(BUILTINS);
      for (const r of records) {
        if (!r || typeof r !== 'object') continue;
        for (const k of Object.keys(r)) colSet.add(k);
      }
      // No records (e.g. audit answers excluded) — pull columns from the schema so the structure still exports fully.
      if (records.length === 0) {
        try {
          const schema = await base44.asServiceRole.entities[entityName].schema();
          for (const k of Object.keys(schema?.properties || {})) colSet.add(k);
        } catch (_e) {
          // ignore — table will just have built-in columns
        }
      }
      // stable column order: built-ins, then rest alphabetically
      const cols = [...BUILTINS, ...[...colSet].filter((c) => !BUILTINS.includes(c)).sort()];
      tables.push({ entityName, table, records, cols, err });
    }

    // CREATE TABLE statements (all first, so order-independent within inserts)
    for (const t of tables) {
      if (t.err) {
        lines.push(`-- Skipped ${t.table}: ${t.err}`);
        continue;
      }
      const colDefs = [];
      for (const col of t.cols) {
        const sn = snakeCase(col);
        const type = inferColumnType(col, t.records.map((r) => r && r[col]));
        const isPk = col === 'id';
        const fkTable = FK_COLUMNS[col];
        let def = `  ${sqlIdent(sn)} ${type}`;
        if (isPk) def += ' PRIMARY KEY';
        if (fkTable) def += ` REFERENCES ${sqlIdent(fkTable)}("id") ON DELETE SET NULL`;
        colDefs.push(def);
      }
      lines.push(`DROP TABLE IF EXISTS ${sqlIdent(t.table)} CASCADE;`);
      lines.push(`CREATE TABLE ${sqlIdent(t.table)} (`);
      lines.push(colDefs.join(',\n'));
      lines.push(');');
      lines.push('');
    }

    // INSERT statements (parent tables already come first in ENTITY_TABLES order)
    for (const t of tables) {
      if (t.err || !t.records.length) continue;
      const snCols = t.cols.map(snakeCase);
      const colList = snCols.map(sqlIdent).join(', ');
      lines.push(`-- ${t.table}: ${t.records.length} row(s)`);
      for (const r of t.records) {
        const vals = t.cols.map((col) => sqlValue(r && r[col]));
        lines.push(`INSERT INTO ${sqlIdent(t.table)} (${colList}) VALUES (${vals.join(', ')});`);
      }
      lines.push('');
    }

    lines.push('COMMIT;');
    lines.push('');
    lines.push(`-- End of export (${tables.reduce((n, t) => n + (t.records ? t.records.length : 0), 0)} total rows).`);

    const sql = lines.join('\n');
    return new Response(sql, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="helpdesk_supabase_${new Date().toISOString().slice(0, 10)}.sql"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});