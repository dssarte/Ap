// Conduct Audit is for the SOD and Quality Assurance departments. Admins and
// directors have it whatever their department; everyone else in another
// department never sees it — not in the menu, not at its address.
const AUDIT_DEPARTMENTS = new Set(['sod', 'quality assurance']);

export function canConductAudits(user) {
  if (!user) return false;
  if (user.user_type === 'admin' || user.user_type === 'director') return true;
  return AUDIT_DEPARTMENTS.has(String(user.department_name || '').trim().toLowerCase());
}
