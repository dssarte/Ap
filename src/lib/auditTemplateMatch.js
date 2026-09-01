// Does this template apply to a given store? Matches by store_id first —
// the stable link — falling back to store_name only for older restriction
// entries saved before store_id was tracked. A name-only match would break
// silently if the store was ever renamed after the restriction was saved.
export function templateAppliesToStore(t, store) {
  if (!store) return false;
  const restrictions = t.store_restrictions?.length > 0
    ? t.store_restrictions
    : t.store_name ? [{ store_name: t.store_name, store_id: t.store_id }] : [];
  if (restrictions.length === 0) return false;
  return restrictions.some(r =>
    (r.store_id && store.id && r.store_id === store.id) || r.store_name === store.store_name
  );
}
