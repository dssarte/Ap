import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function MultiStoreSelect({ stores, brands, selected = [], onChange }) {
  const toggleStore = (storeName) => {
    if (selected.includes(storeName)) {
      onChange(selected.filter(s => s !== storeName));
    } else {
      onChange([...selected, storeName]);
    }
  };

  const allStoreNames = stores.map(s => s.store_name);
  const allSelected = allStoreNames.length > 0 && allStoreNames.every(name => selected.includes(name));

  const toggleAllStores = () => {
    onChange(allSelected ? [] : allStoreNames);
  };

  const toggleBrandStores = (brandStoreNames) => {
    const brandAllSelected = brandStoreNames.every(name => selected.includes(name));
    if (brandAllSelected) {
      onChange(selected.filter(name => !brandStoreNames.includes(name)));
    } else {
      onChange([...new Set([...selected, ...brandStoreNames])]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-slate-900 font-semibold">Assigned Stores</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={toggleAllStores}
          disabled={allStoreNames.length === 0}
        >
          {allSelected ? 'Remove All Branches & Stores' : 'Add All Branches & Stores'}
        </Button>
      </div>
      <p className="text-xs text-slate-500">Select every store this Store Manager can view, approve tickets for, and see analytics on.</p>
      <div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto p-3 space-y-3">
        {brands.map(brand => {
          const brandStores = stores.filter(s => s.brand_id === brand.id).sort((a, b) => (a.store_name || '').localeCompare(b.store_name || ''));
          if (brandStores.length === 0) return null;
          const brandStoreNames = brandStores.map(s => s.store_name);
          const brandAllSelected = brandStoreNames.every(name => selected.includes(name));
          return (
            <div key={brand.id}>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{brand.brand_name}</p>
                <button
                  type="button"
                  className="text-xs font-medium text-[#1a9e47] hover:underline"
                  onClick={() => toggleBrandStores(brandStoreNames)}
                >
                  {brandAllSelected ? 'Remove all' : '+ All Stores'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {brandStores.map(store => (
                  <label key={store.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <Checkbox
                      checked={selected.includes(store.store_name)}
                      onCheckedChange={() => toggleStore(store.store_name)}
                    />
                    {store.store_name}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
        {stores.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No stores available</p>}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-slate-500">{selected.length} store{selected.length !== 1 ? 's' : ''} selected</p>
      )}
    </div>
  );
}
