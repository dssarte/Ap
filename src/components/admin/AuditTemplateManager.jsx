import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ClipboardList } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StoreMultiSelect from "@/components/admin/StoreMultiSelect";

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

function formatTimeLabel(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export default function AuditTemplateManager() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = new

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['audit-templates'],
    queryFn: () => base44.entities.AuditTemplate.list('-created_date', 100),
  });

  const { data: auditCategories = [] } = useQuery({
    queryKey: ['audit-only-categories'],
    queryFn: async () => {
      const cats = await base44.entities.Category.list();
      return cats.filter(c => c.is_audit_only && c.is_active);
    },
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['brands-active'],
    queryFn: () => base44.entities.Brand.filter({ is_active: true }, 'brand_name', 200),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores-active'],
    queryFn: () => base44.entities.Store.filter({ is_active: true }, 'store_name', 200),
  });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editing?.id
        ? base44.entities.AuditTemplate.update(editing.id, data)
        : base44.entities.AuditTemplate.create(data),
    onSuccess: () => { qc.invalidateQueries(['audit-templates']); setDialogOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AuditTemplate.delete(id),
    onSuccess: () => qc.invalidateQueries(['audit-templates']),
  });

  const toggleActive = (tmpl) => {
    base44.entities.AuditTemplate.update(tmpl.id, { is_active: !tmpl.is_active })
      .then(() => qc.invalidateQueries(['audit-templates']));
  };

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (t) => { setEditing(t); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Audit Templates</h2>
          <p className="text-sm text-slate-500">Create and manage audit checklist forms</p>
        </div>
        <Button onClick={openNew} className="bg-[#1fd655] hover:bg-[#1bc14c] text-slate-900 font-semibold gap-2">
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : templates.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-200">
          <CardContent className="py-16 text-center">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">No audit templates yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map(t => (
            <Card key={t.id} className="border-2 border-slate-200 shadow-sm">
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[#1fd655]/10 flex items-center justify-center flex-shrink-0">
                    <ClipboardList className="w-5 h-5 text-[#1fd655]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{t.title}</p>
                    {t.description && <p className="text-xs text-slate-500 truncate">{t.description}</p>}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {t.sections?.length || 0} section(s) · {t.sections?.reduce((s, sec) => s + (sec.items?.length || 0), 0)} items
                    </p>
                    {(t.store_restrictions?.length > 0 || t.store_name) ? (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {(t.store_restrictions?.length > 0 ? t.store_restrictions : [{ brand_name: t.brand_name, store_name: t.store_name }]).map((r, i) => (
                          <span key={i} className="text-xs text-blue-600 font-medium">🏪 {r.brand_name} — {r.store_name}{i < (t.store_restrictions?.length || 1) - 1 ? ',' : ''}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-green-600 mt-0.5 font-medium">👥 Visible to QA</p>
                    )}
                    {t.has_time_restriction && t.available_from_time && t.available_to_time ? (
                      <p className="text-xs text-amber-600 mt-0.5 font-medium">
                        ⏰ {formatTimeLabel(t.available_from_time)} – {formatTimeLabel(t.available_to_time)}{t.available_to_time < t.available_from_time ? ' (next day)' : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-0.5">⏰ No time restriction</p>
                    )}
                    {t.active_ticket && (
                      <p className="text-xs text-purple-600 mt-0.5 font-medium">🎫 Active Ticket — auto-creates ticket on NO</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{t.is_active ? 'Active' : 'Inactive'}</span>
                    <Switch checked={!!t.is_active} onCheckedChange={() => toggleActive(t)} />
                  </div>
                  <Button variant="outline" size="icon" onClick={() => openEdit(t)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="text-red-500 hover:text-red-600" onClick={() => deleteMutation.mutate(t.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TemplateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editing}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
        auditCategories={auditCategories}
        existingTitles={templates.filter(t => !editing || t.id !== editing.id).map(t => t.title.toLowerCase())}
        brands={brands}
        stores={stores}
      />
    </div>
  );
}

function TemplateDialog({ open, onClose, initial, onSave, saving, auditCategories, existingTitles, brands, stores }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState([]);
  const [storeRestrictions, setStoreRestrictions] = useState([]); // [{brand_id, brand_name, store_id, store_name}]
  const [addBrandId, setAddBrandId] = useState('');
  const [addStoreIds, setAddStoreIds] = useState([]);
  const [hasTimeRestriction, setHasTimeRestriction] = useState(false);
  const [availableFromTime, setAvailableFromTime] = useState('06:00');
  const [availableToTime, setAvailableToTime] = useState('17:00');
  const [activeTicket, setActiveTicket] = useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle(initial?.title || '');
      setDescription(initial?.description || '');
      setSections(initial?.sections ? JSON.parse(JSON.stringify(initial.sections)) : []);
      setHasTimeRestriction(!!initial?.has_time_restriction);
      setAvailableFromTime(initial?.available_from_time || '06:00');
      setAvailableToTime(initial?.available_to_time || '17:00');
      setActiveTicket(!!initial?.active_ticket);
      // Load existing restrictions — support both new array format and legacy single store
      if (initial?.store_restrictions?.length) {
        setStoreRestrictions(initial.store_restrictions);
      } else if (initial?.store_id) {
        setStoreRestrictions([{ brand_id: initial.brand_id || '', brand_name: initial.brand_name || '', store_id: initial.store_id, store_name: initial.store_name || '' }]);
      } else {
        setStoreRestrictions([]);
      }
      setAddBrandId('');
      setAddStoreIds([]);
    }
  }, [open, initial]);

  const addFilteredStores = stores.filter(s => s.brand_id === addBrandId && !storeRestrictions.some(r => r.store_id === s.id));

  const addRestriction = () => {
    if (addStoreIds.length === 0) return;
    const brand = brands.find(b => b.id === addBrandId);
    const toAdd = addFilteredStores.filter(s => addStoreIds.includes(s.id));
    if (toAdd.length === 0) return;
    setStoreRestrictions(prev => {
      const next = [...prev];
      toAdd.forEach(store => {
        if (!next.some(r => r.store_id === store.id)) {
          next.push({
            brand_id: brand?.id || '',
            brand_name: brand?.brand_name || '',
            store_id: store.id,
            store_name: store.store_name,
          });
        }
      });
      return next;
    });
    setAddBrandId('');
    setAddStoreIds([]);
  };

  const removeRestriction = (storeId) => {
    setStoreRestrictions(prev => prev.filter(r => r.store_id !== storeId));
  };

  const addSection = () => {
    setSections(s => [...s, { id: genId(), title: '', items: [] }]);
  };

  const updateSection = (idx, field, val) => {
    setSections(s => s.map((sec, i) => i === idx ? { ...sec, [field]: val } : sec));
  };

  const removeSection = (idx) => {
    setSections(s => s.filter((_, i) => i !== idx));
  };

  const addItem = (secIdx) => {
    setSections(s => s.map((sec, i) =>
      i === secIdx ? { ...sec, items: [...(sec.items || []), { id: genId(), label: '', photo_required: false }] } : sec
    ));
  };

  const updateItem = (secIdx, itemIdx, val) => {
    setSections(s => s.map((sec, i) =>
      i === secIdx
        ? { ...sec, items: sec.items.map((it, j) => j === itemIdx ? { ...it, label: val } : it) }
        : sec
    ));
  };

  const toggleItemPhoto = (secIdx, itemIdx) => {
    setSections(s => s.map((sec, i) =>
      i === secIdx
        ? { ...sec, items: sec.items.map((it, j) => j === itemIdx ? { ...it, photo_required: !it.photo_required } : it) }
        : sec
    ));
  };

  const removeItem = (secIdx, itemIdx) => {
    setSections(s => s.map((sec, i) =>
      i === secIdx ? { ...sec, items: sec.items.filter((_, j) => j !== itemIdx) } : sec
    ));
  };

  const handleSave = () => {
    if (!title.trim()) return;
    // For backward compat: store the first restriction in legacy fields too
    const first = storeRestrictions[0];
    onSave({
      title: title.trim(),
      description: description.trim(),
      sections,
      is_active: initial?.is_active ?? true,
      active_ticket: activeTicket,
      has_time_restriction: hasTimeRestriction,
      available_from_time: hasTimeRestriction ? availableFromTime : '',
      available_to_time: hasTimeRestriction ? availableToTime : '',
      store_restrictions: storeRestrictions,
      // legacy fields — keep first entry for anything reading the old schema
      brand_id: first?.brand_id || '',
      brand_name: first?.brand_name || '',
      store_id: first?.store_id || '',
      store_name: first?.store_name || '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'Edit Audit Template' : 'New Audit Template'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Title *</label>
            {auditCategories.length > 0 ? (
              <>
                <Select value={title} onValueChange={setTitle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category as title..." />
                  </SelectTrigger>
                  <SelectContent>
                    {auditCategories.map(c => {
                      const alreadyUsed = existingTitles.includes(c.name.toLowerCase());
                      return (
                        <SelectItem key={c.id} value={c.name} disabled={alreadyUsed}>
                          {c.name}{alreadyUsed ? ' (already added)' : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <Input placeholder="e.g. Product Quality Audit" value={title} onChange={e => setTitle(e.target.value)} />
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Description</label>
            <Textarea placeholder="Short description..." value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>

          {/* Store restrictions — optional, multiple */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Store Restrictions <span className="text-slate-400 font-normal">(optional)</span></label>
            <p className="text-xs text-slate-500">If any stores are added, only users from those stores can see this template. Leave empty to make it visible to all QA users.</p>

            {/* Existing restrictions */}
            {storeRestrictions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {storeRestrictions.map(r => (
                  <div key={r.store_id} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-xs font-medium text-blue-800">
                    🏪 {r.brand_name} — {r.store_name}
                    <button onClick={() => removeRestriction(r.store_id)} className="ml-1 text-blue-400 hover:text-red-500 font-bold leading-none">✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add a new restriction */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={addBrandId} onValueChange={(val) => { setAddBrandId(val); setAddStoreIds([]); }}>
                <SelectTrigger className="w-44 h-9">
                  <SelectValue placeholder="Brand..." />
                </SelectTrigger>
                <SelectContent>
                  {brands.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <StoreMultiSelect
                stores={addFilteredStores}
                selected={addStoreIds}
                onChange={setAddStoreIds}
                disabled={!addBrandId}
                placeholder={addBrandId ? "Store..." : "Select brand first"}
              />
              <Button variant="outline" size="sm" onClick={addRestriction} disabled={addStoreIds.length === 0} className="h-9 gap-1">
                <Plus className="w-3.5 h-3.5" /> Add{addStoreIds.length > 1 ? ` (${addStoreIds.length})` : ''}
              </Button>
            </div>
          </div>

          {/* Time restriction */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={hasTimeRestriction} onCheckedChange={setHasTimeRestriction} />
              <span className="text-sm font-semibold text-slate-700">Time Restriction <span className="text-slate-400 font-normal">(optional)</span></span>
            </label>
            <p className="text-xs text-slate-500">Only allow this audit to be started within a daily time window. Leave off to allow anytime.</p>
            {hasTimeRestriction && (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={availableFromTime}
                  onChange={e => setAvailableFromTime(e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-[#1fd655]"
                />
                <span className="text-slate-400 text-sm">to</span>
                <input
                  type="time"
                  value={availableToTime}
                  onChange={e => setAvailableToTime(e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-[#1fd655]"
                />
                {availableToTime < availableFromTime && (
                  <span className="text-xs text-amber-600 font-medium">(ends next day)</span>
                )}
              </div>
            )}
          </div>

          {/* Active Ticket — auto-create ticket on NO */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={activeTicket} onCheckedChange={setActiveTicket} />
              <span className="text-sm font-semibold text-slate-700">Active Ticket <span className="text-slate-400 font-normal">(optional)</span></span>
            </label>
            <p className="text-xs text-slate-500">When enabled, submitting this audit with any NO answer automatically creates a ticket routed to the handling department head. YES/N/A-only submissions create no ticket.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">Sections</label>
              <Button variant="outline" size="sm" onClick={addSection} className="gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Section
              </Button>
            </div>

            {sections.map((sec, secIdx) => (
              <Card key={sec.id} className="border-2 border-slate-200">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={`Section title (e.g. A.1 PRODUCT QUALITY)`}
                      value={sec.title}
                      onChange={e => updateSection(secIdx, 'title', e.target.value)}
                      className="font-semibold"
                    />
                    <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 flex-shrink-0" onClick={() => removeSection(secIdx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 pl-2">
                    {(sec.items || []).map((item, itemIdx) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-5">{itemIdx + 1}.</span>
                        <Input
                          placeholder="Checklist item..."
                          value={item.label}
                          onChange={e => updateItem(secIdx, itemIdx, e.target.value)}
                          className="h-8 text-sm"
                        />
                        <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer">
                          <Switch checked={!!item.photo_required} onCheckedChange={() => toggleItemPhoto(secIdx, itemIdx)} className="scale-90" />
                          <span className="text-xs text-slate-500 whitespace-nowrap">Photo</span>
                        </label>
                        <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 h-8 w-8 flex-shrink-0" onClick={() => removeItem(secIdx, itemIdx)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="text-[#1fd655] gap-1 h-7 text-xs" onClick={() => addItem(secIdx)}>
                      <Plus className="w-3 h-3" /> Add Item
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {sections.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4 border-2 border-dashed border-slate-200 rounded-lg">
                No sections yet. Add a section to build your checklist.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!title.trim() || saving} className="bg-[#1fd655] hover:bg-[#1bc14c] text-slate-900 font-semibold">
              {saving ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}