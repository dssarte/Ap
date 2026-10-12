import { useState, useMemo, useEffect } from 'react';

// Client-side pagination for a list that's already filtered and sorted.
// Jumps back to page 1 when the list's size changes (e.g. a filter was
// applied) and clamps if the current page falls out of range.
export function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => { setPage(1); }, [items.length]);
  useEffect(() => { setPage(p => Math.min(p, totalPages)); }, [totalPages]);

  const startIndex = (page - 1) * pageSize;
  const pageItems = useMemo(() => items.slice(startIndex, startIndex + pageSize), [items, startIndex, pageSize]);

  return { page, setPage, totalPages, pageItems, startIndex };
}
