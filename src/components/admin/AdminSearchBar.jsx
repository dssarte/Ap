import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Shared search input for the Admin tabs' list views — one place to fix
// styling/spacing instead of ten near-identical copies drifting apart.
export default function AdminSearchBar({ value, onChange, placeholder = 'Search...', wrapperClassName = 'relative mt-4 mb-4' }) {
  return (
    <div className={wrapperClassName}>
      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}
