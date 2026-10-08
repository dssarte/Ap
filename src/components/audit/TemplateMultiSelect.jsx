import React, { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Check } from "lucide-react";

// Mirrors StoreMultiSelect's pattern (checkbox popover list with a "Select
// All" toggle) — lets the dashboard scope its query to just a handful of
// checklists instead of fetching every template's submissions for the whole
// date range, which also keeps a wide range from timing out.
//
// maxSelected caps how many can be picked at once — audit_dashboard_summary
// still scans every matching row for the chosen templates, so beyond a
// handful of high-volume (daily) checklists across a multi-month range it
// can time out regardless of the aggregation; capping the selection keeps
// the query scoped to something that reliably finishes in time.
export default function TemplateMultiSelect({ templates, selected, onChange, disabled, placeholder, maxSelected = 3 }) {
  const [open, setOpen] = useState(false);
  const allSelected = templates.length > 0 && selected.length === templates.length;
  const atLimit = maxSelected != null && selected.length >= maxSelected;

  const toggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter(x => x !== id));
    } else {
      if (atLimit) return;
      onChange([...selected, id]);
    }
  };

  const selectAll = () => {
    if (allSelected) {
      onChange([]);
    } else if (!maxSelected || templates.length <= maxSelected) {
      onChange(templates.map(t => t.id));
    }
  };

  const label = selected.length === 0
    ? (placeholder || 'All Templates')
    : selected.length === 1
      ? (templates.find(t => t.id === selected[0])?.title || '1 template')
      : `${selected.length} templates selected`;

  const selectAllDisabled = !allSelected && maxSelected != null && templates.length > maxSelected;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-56 h-9 justify-between font-normal bg-transparent"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={selectAll}
            disabled={selectAllDisabled}
            title={selectAllDisabled ? `Select up to ${maxSelected} at a time` : undefined}
            className="h-7 text-xs font-semibold gap-1.5"
          >
            <Checkbox checked={allSelected} className="h-3.5 w-3.5" />
            Select All
          </Button>
          <span className={`text-xs ${atLimit ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
            {selected.length}/{maxSelected ? `${maxSelected} max` : templates.length}
          </span>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {templates.length === 0 ? (
            <p className="px-3 py-4 text-xs text-slate-400 text-center">No templates available</p>
          ) : templates.map(t => {
            const checked = selected.includes(t.id);
            const disableRow = !checked && atLimit;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                disabled={disableRow}
                title={disableRow ? `Select up to ${maxSelected} at a time` : undefined}
                className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-sm ${disableRow ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50'}`}
              >
                <Checkbox checked={checked} className="h-4 w-4 pointer-events-none flex-shrink-0" />
                <span className="flex-1 truncate text-slate-700">{t.title}</span>
                {checked && <Check className="w-3.5 h-3.5 text-[#1fd655] flex-shrink-0" />}
              </button>
            );
          })}
        </div>
        {maxSelected != null && (
          <div className="px-3 py-1.5 border-t border-slate-100 text-[11px] text-slate-400">
            Select up to {maxSelected} templates at a time to keep results fast.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
