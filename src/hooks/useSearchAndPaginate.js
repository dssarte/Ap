import { useState, useMemo, useEffect } from 'react';

// Shared search + pagination for the Admin tabs' list views — fixed at 10
// items per page everywhere for consistency. `searchFn(item, query)`
// decides what counts as a match; each tab keeps its own notion of which
// fields are searchable instead of this guessing generically.
export function useSearchAndPaginate(items, searchFn, pageSize = 10) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item => searchFn(item, q));
  }, [items, search, searchFn]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Jump back to page 1 whenever the search (or the underlying list size)
  // changes, so a narrowed search never leaves you stranded on a now-empty
  // page 4. Separately clamp if the current page became out of range for
  // some other reason (e.g. an item was deleted off the last page).
  useEffect(() => { setPage(1); }, [search, items.length]);
  useEffect(() => { setPage(p => Math.min(p, totalPages)); }, [totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return { search, setSearch, page, setPage, totalPages, pageItems, filteredCount: filtered.length, totalCount: items.length };
}
