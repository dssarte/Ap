import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Loader2, Flag, Search } from 'lucide-react';
import { describeHolidayDates } from '@/lib/storeHolidays';

// Holidays and one-off closures (store_holidays): on those days the stores
// picked have nothing due, so checklist completion leaves the day out —
// the grid shows a flag instead of a miss. Admins only.
const emptyForm = () => ({ name: '', date_from: '', date_to: '', all_stores: true, store_ids: [] });
const manilaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

function HolidayRow({ holiday, storesLabel, storeNames, past, onEdit, onDelete, deleting }) {
  return (
    <Card className={`border border-slate-200 ${past ? 'bg-slate-50/60' : ''}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`rounded-md p-2 ${past ? 'bg-slate-100' : 'bg-violet-100'}`}>
          <Flag className={`h-4 w-4 ${past ? 'text-slate-400' : 'text-violet-700'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold ${past ? 'text-slate-600' : 'text-slate-900'}`}>{holiday.name}</p>
          <p className="text-xs text-slate-500">{describeHolidayDates(holiday)}</p>
        </div>
        <Badge variant="outline" className="max-w-[45%] truncate text-xs text-slate-600" title={storeNames || 'Every store'}>{storesLabel}</Badge>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={onEdit} aria-label={`Edit ${holiday.name}`}>
          <Pencil className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={onDelete} disabled={deleting} aria-label={`Delete ${holiday.name}`}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function HolidayManager() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');
  const [formError, setFormError] = useState('');

  const { data: holidays = [], isLoading, error: loadError } = useQuery({
    queryKey: ['store-holidays-admin'],
    queryFn: () => base44.entities.StoreHoliday.list('-date_from', 2000),
  });
  const { data: stores = [] } = useQuery({
    queryKey: ['stores-active'],
    queryFn: () => base44.entities.Store.filter({ is_active: true, kind: 'store' }, 'store_name', 2000),
  });
  const storeById = useMemo(() => new Map(stores.map(s => [s.id, s])), [stores]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['store-holidays-admin'] });
    qc.invalidateQueries({ queryKey: ['store-holidays'] });
  };
  const close = () => { setForm(emptyForm()); setEditingId(null); setShowForm(false); setStoreSearch(''); setFormError(''); };
  const saveMutation = useMutation({
    mutationFn: (payload) => (editingId ? base44.entities.StoreHoliday.update(editingId, payload) : base44.entities.StoreHoliday.create(payload)),
    onSuccess: () => { refresh(); close(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.StoreHoliday.delete(id),
    onSuccess: refresh,
  });

  const startAdd = () => { close(); saveMutation.reset(); setShowForm(true); };
  const startEdit = (h) => {
    setForm({ name: h.name, date_from: h.date_from, date_to: h.date_to === h.date_from ? '' : h.date_to, all_stores: h.all_stores, store_ids: h.store_ids || [] });
    setEditingId(h.id);
    setShowForm(true);
    setFormError('');
    saveMutation.reset();
  };

  const handleSave = () => {
    const name = form.name.trim();
    const dateTo = form.date_to || form.date_from;
    if (!name) { setFormError('Give the holiday a name.'); return; }
    if (!form.date_from) { setFormError('Pick the date.'); return; }
    if (dateTo < form.date_from) { setFormError('The last day is before the first.'); return; }
    if (!form.all_stores && !form.store_ids.length) { setFormError('Pick at least one store, or choose All stores.'); return; }
    setFormError('');
    saveMutation.mutate({
      name,
      date_from: form.date_from,
      date_to: dateTo,
      all_stores: form.all_stores,
      store_ids: form.all_stores ? [] : form.store_ids,
      ...(editingId ? {} : { created_by: user?.email || null }),
    });
  };

  // The store picker: active stores by brand, narrowed by the search.
  const brandGroups = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    const groups = new Map();
    [...stores]
      .sort((a, b) => (a.brand_name || '').localeCompare(b.brand_name || '') || (a.store_name || '').localeCompare(b.store_name || ''))
      .filter(s => !q || (s.store_name || '').toLowerCase().includes(q) || (s.brand_name || '').toLowerCase().includes(q))
      .forEach(s => {
        const key = s.brand_name || 'Other';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(s);
      });
    return [...groups].map(([brand, list]) => ({ brand, stores: list }));
  }, [stores, storeSearch]);
  const picked = new Set(form.store_ids);
  const toggleStore = (id) => setForm(f => ({ ...f, store_ids: f.store_ids.includes(id) ? f.store_ids.filter(x => x !== id) : [...f.store_ids, id] }));
  const toggleGroup = (group) => setForm(f => {
    const ids = group.stores.map(s => s.id);
    const allPicked = ids.every(id => f.store_ids.includes(id));
    return { ...f, store_ids: allPicked ? f.store_ids.filter(id => !ids.includes(id)) : [...new Set([...f.store_ids, ...ids])] };
  });

  const today = manilaToday();
  const upcoming = holidays.filter(h => h.date_to >= today).sort((a, b) => a.date_from.localeCompare(b.date_from));
  const past = holidays.filter(h => h.date_to < today).sort((a, b) => b.date_from.localeCompare(a.date_from));
  const storesLabel = (h) => (h.all_stores ? 'All stores' : `${h.store_ids.length} store${h.store_ids.length === 1 ? '' : 's'}`);
  const storeNames = (h) => (h.all_stores ? '' : h.store_ids.map(id => storeById.get(id)?.store_name || 'a removed store').join(', '));
  const remove = (h) => { if (confirm(`Delete "${h.name}"? Those days count toward completion again.`)) deleteMutation.mutate(h.id); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-500">
          Days stores close for a holiday or another reason. Nothing is due on them, so they don't count against checklist completion — the Audit Dashboard shows a flag instead.
        </p>
        {!showForm && (
          <Button onClick={startAdd} className="bg-[#1fd655] hover:bg-[#1bc14c] text-slate-900 font-semibold gap-2">
            <Plus className="w-4 h-4" /> Add Holiday
          </Button>
        )}
      </div>

      {loadError && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Holidays need the latest database update — run supabase/migrations/20261113010000_store_holidays.sql in Supabase. ({loadError.message})
        </p>
      )}

      {showForm && (
        <Card className="border-2 border-[#1fd655]/40">
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold text-slate-800">{editingId ? 'Edit' : 'New'} Holiday</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Name *</label>
                <Input placeholder="e.g. Christmas Day" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Date *</label>
                <Input
                  type="date"
                  value={form.date_from}
                  onChange={e => setForm(f => ({ ...f, date_from: e.target.value, date_to: f.date_to && f.date_to < e.target.value ? '' : f.date_to }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Until (more than one day)</label>
                <Input type="date" min={form.date_from || undefined} value={form.date_to} onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 block">Stores closed</label>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Stores closed">
                {[{ value: true, label: 'All stores' }, { value: false, label: 'Pick stores' }].map(option => (
                  <button
                    key={option.label}
                    type="button"
                    aria-pressed={form.all_stores === option.value}
                    onClick={() => setForm(f => ({ ...f, all_stores: option.value }))}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${form.all_stores === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {!form.all_stores && (
                <div className="rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 border-b border-slate-100 p-2">
                    <Search className="h-4 w-4 shrink-0 text-slate-400" />
                    <Input className="h-8 border-0 shadow-none focus-visible:ring-0" placeholder="Search stores or brands…" value={storeSearch} onChange={e => setStoreSearch(e.target.value)} />
                    <span className="shrink-0 text-xs font-semibold text-slate-500">{form.store_ids.length} picked</span>
                  </div>
                  <div className="max-h-72 space-y-3 overflow-y-auto p-3">
                    {brandGroups.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No stores match "{storeSearch}".</p>}
                    {brandGroups.map(group => {
                      const allPicked = group.stores.every(s => picked.has(s.id));
                      return (
                        <div key={group.brand}>
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{group.brand}</p>
                            <button type="button" onClick={() => toggleGroup(group)} className="text-xs font-semibold text-blue-600 hover:underline">
                              {allPicked ? 'Clear' : `Pick all ${group.stores.length}`}
                            </button>
                          </div>
                          <div className="grid gap-x-3 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                            {group.stores.map(s => (
                              <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm text-slate-700 hover:bg-slate-50">
                                <Checkbox checked={picked.has(s.id)} onCheckedChange={() => toggleStore(s.id)} />
                                <span className="truncate">{s.store_name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {(formError || saveMutation.isError) && (
              <p className="text-sm text-red-600">{formError || `Couldn't save the holiday: ${saveMutation.error?.message}`}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={close}>Cancel</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-[#1fd655] hover:bg-[#1bc14c] text-slate-900 font-semibold">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? 'Update' : 'Save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : !loadError && holidays.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-200">
          <CardContent className="py-10 text-center">
            <Flag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400">No holidays added yet.</p>
          </CardContent>
        </Card>
      ) : (
        [['Upcoming', upcoming, false], ['Past', past, true]].map(([title, list, isPast]) => list.length > 0 && (
          <div key={title} className="space-y-2">
            <p className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
            {list.map(h => (
              <HolidayRow
                key={h.id}
                holiday={h}
                past={isPast}
                storesLabel={storesLabel(h)}
                storeNames={storeNames(h)}
                onEdit={() => startEdit(h)}
                onDelete={() => remove(h)}
                deleting={deleteMutation.isPending}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
