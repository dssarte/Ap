// Stores are corporate (company-owned) or franchise — stores.ownership,
// added Nov 2026 with every store that existed then corporate.
export const OWNERSHIP_OPTIONS = [
  { value: 'corporate', label: 'Corporate' },
  { value: 'franchise', label: 'Franchise' },
];

export const storeOwnership = (store) => (store?.ownership === 'franchise' ? 'franchise' : 'corporate');

export const ownershipLabel = (value) => (value === 'franchise' ? 'Franchise' : 'Corporate');

/**
 * Corporate or franchise for a submission's store label — "Brand - Store",
 * or "Brand - Store, Location". It's a franchise store's when the label is
 * that store's "Brand - Store" or starts with it plus a comma: the same rule
 * as audit_dashboard_summary, so a tab's lists and its totals agree.
 * Anything else (a corporate store, a department checklist) is corporate.
 * Returns a function of the label; each distinct label is worked out once.
 */
export function labelOwnership(stores) {
  const franchise = new Set(
    stores
      .filter(store => storeOwnership(store) === 'franchise')
      .map(store => `${store.brand_name} - ${store.store_name}`.toLowerCase()),
  );
  const known = new Map();
  return (label) => {
    const key = String(label || '').toLowerCase();
    if (!known.has(key)) {
      let isFranchise = franchise.has(key);
      for (let i = key.indexOf(','); !isFranchise && i !== -1; i = key.indexOf(',', i + 1)) {
        isFranchise = franchise.has(key.slice(0, i));
      }
      known.set(key, isFranchise ? 'franchise' : 'corporate');
    }
    return known.get(key);
  };
}
