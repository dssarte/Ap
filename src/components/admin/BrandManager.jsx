import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Loader2, Store, Tag } from "lucide-react";

// ─── Brand CRUD ────────────────────────────────────────────────────────────────
function BrandsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ brand_name: '', is_active: true });
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['brands-admin'],
    queryFn: () => base44.entities.Brand.list('brand_name', 200),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editingId ? base44.entities.Brand.update(editingId, data) : base44.entities.Brand.create(data),
    onSuccess: () => { qc.invalidateQueries(['brands-admin']); setForm({ brand_name: '', is_active: true }); setEditingId(null); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Brand.delete(id),
    onSuccess: () => qc.invalidateQueries(['brands-admin']),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.Brand.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries(['brands-admin']),
  });

  const startEdit = (b) => { setForm({ brand_name: b.brand_name, is_active: b.is_active }); setEditingId(b.id); setShowForm(true); };
  const cancel = () => { setForm({ brand_name: '', is_active: true }); setEditingId(null); setShowForm(false); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage brand names (e.g. Angels Pizza, Figaro)</p>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="bg-[#1fd655] hover:bg-[#1bc14c] text-slate-900 font-semibold gap-2">
            <Plus className="w-4 h-4" /> Add Brand
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-2 border-[#1fd655]/40">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-slate-800">{editingId ? 'Edit' : 'New'} Brand</h3>
            <div className="flex gap-3">
              <Input
                placeholder="Brand name e.g. Angels Pizza"
                value={form.brand_name}
                onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))}
                className="flex-1"
              />
              <Button variant="outline" onClick={cancel}>Cancel</Button>
              <Button onClick={() => form.brand_name.trim() && saveMutation.mutate(form)} disabled={saveMutation.isPending} className="bg-[#1fd655] hover:bg-[#1bc14c] text-slate-900 font-semibold">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? 'Update' : 'Save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : brands.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-200">
          <CardContent className="py-10 text-center">
            <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400">No brands added yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {brands.map(b => (
            <Card key={b.id} className="border border-slate-200">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 font-semibold text-slate-900">{b.brand_name}</div>
                <Badge
                  className={`cursor-pointer text-xs ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
                  onClick={() => toggleMutation.mutate({ id: b.id, is_active: !b.is_active })}
                >
                  {b.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => startEdit(b)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600"
                  onClick={() => confirm('Delete this brand?') && deleteMutation.mutate(b.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Store CRUD ────────────────────────────────────────────────────────────────
function StoresTab() {
  const qc = useQueryClient();
  const emptyForm = { brand_id: '', brand_name: '', store_name: '', location: '', is_active: true };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const { data: brands = [] } = useQuery({
    queryKey: ['brands-admin'],
    queryFn: () => base44.entities.Brand.list('brand_name', 200),
  });

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['stores-admin'],
    queryFn: () => base44.entities.Store.list('brand_name', 200),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editingId ? base44.entities.Store.update(editingId, data) : base44.entities.Store.create(data),
    onSuccess: () => { qc.invalidateQueries(['stores-admin']); setForm(emptyForm); setEditingId(null); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Store.delete(id),
    onSuccess: () => qc.invalidateQueries(['stores-admin']),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.Store.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries(['stores-admin']),
  });

  const startEdit = (s) => {
    setForm({ brand_id: s.brand_id, brand_name: s.brand_name, store_name: s.store_name, location: s.location || '', is_active: s.is_active });
    setEditingId(s.id);
    setShowForm(true);
  };
  const cancel = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); };

  const handleBrandSelect = (brandId) => {
    const brand = brands.find(b => b.id === brandId);
    setForm(f => ({ ...f, brand_id: brandId, brand_name: brand?.brand_name || '' }));
  };

  const handleSave = () => {
    if (!form.brand_id || !form.store_name.trim()) return;
    saveMutation.mutate(form);
  };

  // Group stores by brand for display
  const grouped = stores.reduce((acc, s) => {
    const key = s.brand_name || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage stores/branches under each brand</p>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="bg-[#1fd655] hover:bg-[#1bc14c] text-slate-900 font-semibold gap-2">
            <Plus className="w-4 h-4" /> Add Store
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-2 border-[#1fd655]/40">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-slate-800">{editingId ? 'Edit' : 'New'} Store</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Brand *</label>
                <Select value={form.brand_id} onValueChange={handleBrandSelect}>
                  <SelectTrigger><SelectValue placeholder="Select brand..." /></SelectTrigger>
                  <SelectContent>
                    {brands.filter(b => b.is_active).map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Store Name *</label>
                <Input placeholder="e.g. Store Mayon" value={form.store_name} onChange={e => setForm(f => ({ ...f, store_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Location</label>
                <Input placeholder="e.g. Makati" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={cancel}>Cancel</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-[#1fd655] hover:bg-[#1bc14c] text-slate-900 font-semibold">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? 'Update' : 'Save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : stores.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-200">
          <CardContent className="py-10 text-center">
            <Store className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400">No stores added yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([brandName, brandStores]) => (
            <div key={brandName}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 px-1">{brandName}</p>
              <div className="space-y-2">
                {brandStores.map(s => (
                  <Card key={s.id} className="border border-slate-200">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900">{s.store_name}</p>
                        {s.location && <p className="text-xs text-slate-500">{s.location}</p>}
                      </div>
                      <Badge
                        className={`cursor-pointer text-xs ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
                        onClick={() => toggleMutation.mutate({ id: s.id, is_active: !s.is_active })}
                      >
                        {s.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => startEdit(s)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600"
                        onClick={() => confirm('Delete this store?') && deleteMutation.mutate(s.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────
export default function BrandManager() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Brands & Stores</h2>
      <Tabs defaultValue="brands">
        <TabsList className="mb-4">
          <TabsTrigger value="brands" className="gap-2"><Tag className="w-4 h-4" /> Brands</TabsTrigger>
          <TabsTrigger value="stores" className="gap-2"><Store className="w-4 h-4" /> Stores</TabsTrigger>
        </TabsList>
        <TabsContent value="brands"><BrandsTab /></TabsContent>
        <TabsContent value="stores"><StoresTab /></TabsContent>
      </Tabs>
    </div>
  );
}