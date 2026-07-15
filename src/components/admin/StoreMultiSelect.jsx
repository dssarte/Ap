import React, { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Check } from "lucide-react";

export default function StoreMultiSelect({ stores, selected, onChange, disabled, placeholder }) {
  const [open, setOpen] = useState(false);
  const allSelected = stores.length > 0 && selected.length === stores.length;

  const toggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter(x => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const selectAll = () => {
    onChange(allSelected ? [] : stores.map(s => s.id));
  };

  const label = selected.length === 0
    ? (placeholder || 'Store...')
    : selected.length === 1
      ? (() => { const s = stores.find(x => x.id === selected[0]); return s ? `${s.store_name}${s.location ? `, ${s.location}` : ''}` : '1 store'; })()
      : `${selected.length} stores selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-52 h-9 justify-between font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={selectAll}
            className="h-7 text-xs font-semibold gap-1.5"
          >
            <Checkbox checked={allSelected} className="h-3.5 w-3.5" />
            Select All
          </Button>
          <span className="text-xs text-slate-400">{selected.length}/{stores.length}</span>
        </div>
        <div className="max-h-60 overflow-y-auto py-1">
          {stores.length === 0 ? (
            <p className="px-3 py-4 text-xs text-slate-400 text-center">No stores available</p>
          ) : stores.map(s => {
            const checked = selected.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
              >
                <Checkbox checked={checked} className="h-4 w-4 pointer-events-none" />
                <span className="flex-1 truncate text-slate-700">
                  {s.store_name}{s.location ? `, ${s.location}` : ''}
                </span>
                {checked && <Check className="w-3.5 h-3.5 text-[#1fd655] flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}