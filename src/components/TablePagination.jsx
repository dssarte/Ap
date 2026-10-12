import React from 'react';
import { Button } from "@/components/ui/button";

export default function TablePagination({ page, totalPages, onPageChange, className = '' }) {
  if (totalPages <= 1) return null;
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <p className="text-xs text-slate-500">Page {page} of {totalPages}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 1}>Previous</Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>Next</Button>
      </div>
    </div>
  );
}
