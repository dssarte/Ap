import React from 'react';
import { Loader2 } from 'lucide-react';

// A loading spinner that keeps turning while the page is busy: the spin is
// a transform on its own layer (a plain box around the icon), which the
// browser animates off the main thread — unlike a spinning icon, which can
// freeze while a large date range is being processed.
export default function Spinner({ className = 'h-6 w-6', iconClassName = 'text-slate-400', label = 'Loading' }) {
  return (
    <span role="status" aria-label={label} className={`inline-flex shrink-0 animate-spin will-change-transform ${className}`}>
      <Loader2 className={`h-full w-full ${iconClassName}`} />
    </span>
  );
}
