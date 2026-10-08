// Conduct Audit groups checklists into these top-level tabs. Separate axis
// from a template's `template_group` (brand-based, used by the admin
// template editor's own tabs) — a single brand can have templates split
// across several of these categories (e.g. Angel's Pizza has a Store Audit
// checklist, a Punchlist, AND a Mystery Shopper checklist).
//
// The 'qa' category was merged into 'store_audit' (one tab instead of two) —
// `value` stays as 'mayon' under the new "Head Office" label to avoid a
// migration, same as audit_type's internal codes ('follow_up') differing
// from their display labels ('Follow-up').
export const CHECKLIST_CATEGORIES = [
  { value: 'mystery_shopper', label: 'Mystery Shopper' },
  { value: 'store_audit', label: 'Store Audit' },
  { value: 'punchlist', label: 'Store Punchlist' },
  { value: 'commissary', label: 'Commissary' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'mayon', label: 'Head Office' },
];

export const CHECKLIST_CATEGORY_LABELS = Object.fromEntries(
  CHECKLIST_CATEGORIES.map(c => [c.value, c.label])
);

const KNOWN_CATEGORY_VALUES = new Set(CHECKLIST_CATEGORIES.map(c => c.value));

// Falls back to 'store_audit' for anything not in the current list —
// covers the pre-merge 'qa' value (and any other stale value) so templates
// never silently disappear from every tab while a backfill migration is
// still pending in Supabase.
export function normalizeChecklistCategory(value) {
  return value && KNOWN_CATEGORY_VALUES.has(value) ? value : 'store_audit';
}
