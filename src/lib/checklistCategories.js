// Conduct Audit groups checklists into these top-level tabs. Separate axis
// from a template's `template_group` (brand-based, used by the admin
// template editor's own tabs) — a single brand can have templates split
// across several of these categories (e.g. Angel's Pizza has a QA
// checklist, a Punchlist, AND a Mystery Shopper checklist).
export const CHECKLIST_CATEGORIES = [
  { value: 'qa', label: 'QA' },
  { value: 'mystery_shopper', label: 'Mystery Shopper' },
  { value: 'store_audit', label: 'Store Audit' },
  { value: 'punchlist', label: 'Store Punchlist' },
  { value: 'commissary', label: 'Commissary' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'mayon', label: 'Mayon' },
];

export const CHECKLIST_CATEGORY_LABELS = Object.fromEntries(
  CHECKLIST_CATEGORIES.map(c => [c.value, c.label])
);
