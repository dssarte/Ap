import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function MultiStoreSelect({ stores, brands, selected = [], onChange }) {
  const toggleStore = (storeName) => {
    if (selected.includes(storeName)) {
      onChange(selected.filter(s => s !== storeName));
    } else {
      onChange([...selected, storeName]);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-slate-900 font-semibold">Assigned Stores</Label>
      <p className="text-xs text-slate-500">Select every store this Store Manager can view, approve tickets for, and see analytics on.</p>
      <div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto p-3 space-y-3">
        {brands.map(brand => {
          const brandStores = stores.filter(s => s.brand_id === brand.id);
          if (brandStores.length === 0) return null;
          return (
            <div key={brand.id}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{brand.brand_name}</p>
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