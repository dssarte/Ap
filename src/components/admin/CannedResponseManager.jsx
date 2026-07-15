import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Globe, Building2, Search } from "lucide-react";

const EMPTY_FORM = { title: '', content: '', department_id: '', department_name: '', is_active: true };

export default function CannedResponseManager() {
  const [responses, setResponses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const [r, d] = await Promise.all([
      base44.entities.CannedResponse.list(),
      base44.entities.Department.filter({ is_active: true })
    ]);
    setResponses(r);
    setDepartments(d);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setForm({ title: r.title, content: r.content, department_id: r.department_id || '', department_name: r.department_name || '', is_active: r.is_active });
    setShowDialog(true);
  };

  const handleDeptChange = (val) => {
    if (val === '__global__') {
      setForm(f => ({ ...f, department_id: '', department_name: '' }));
    } else {
      const dept = departments.find(d => d.id === val);
      setForm(f => ({ ...f, department_id: val, department_name: dept?.name || '' }));
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    const data = {
      title: form.title.trim(),
      content: form.content.trim(),
      department_id: form.department_id || '',
      department_name: form.department_name || '',
      is_active: form.is_active
    };
    if (editing) {
      await base44.entities.CannedResponse.update(editing.id, data);
    } else {
      await base44.entities.CannedResponse.create(data);
    }
    setSaving(false);
    setShowDialog(false);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.CannedResponse.delete(id);
    setDeleteId(null);
    load();
  };

  const filtered = responses.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase()) || r.content.toLowerCase().includes(search.toLowerCase());
    const matchDept = filterDept === 'all' || (filterDept === 'global' ? !r.department_id : r.department_id === filterDept);
    return matchSearch && matchDept;
  });

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search responses..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="global">Global (All Depts)</SelectItem>
            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openAdd} className="bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold gap-2">
          <Plus className="w-4 h-4" /> Add Response
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="p-12 text-center text-slate-500">
            <p className="font-medium">No canned responses found.</p>
            <p className="text-sm mt-1">Click "Add Response" to create your first template.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <Card key={r.id} className={`border-2 ${r.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'} hover:border-[#1fd655]/40 transition-colors`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900">{r.title}</span>
                      {r.department_id ? (
                        <Badge className="bg-blue-100 text-blue-700 border-0 gap-1 text-xs">
                          <Building2 className="w-3 h-3" /> {r.department_name}
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 border-0 gap-1 text-xs">
                          <Globe className="w-3 h-3" /> Global
                        </Badge>
                      )}
                      {!r.is_active && <Badge variant="outline" className="text-xs text-slate-400">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2 whitespace-pre-wrap">{r.content}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteId(r.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Canned Response' : 'New Canned Response'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Title <span className="text-red-500">*</span></label>
              <Input
                placeholder="e.g. Greeting, Request More Info, Resolved"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Department</label>
              <Select value={form.department_id || '__global__'} onValueChange={handleDeptChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">
                    <span className="flex items-center gap-2"><Globe className="w-4 h-4" /> Global (All Departments)</span>
                  </SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">Global responses are visible to all departments.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Response Text <span className="text-red-500">*</span></label>
              <Textarea
                placeholder="Type the template message here..."
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={5}
                className="resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="is_active" className="text-sm text-slate-700">Active</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.title.trim() || !form.content.trim()}
              className="bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Canned Response?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-2">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleDelete(deleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}