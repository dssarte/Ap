import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Building2, Clock } from "lucide-react";
import { isTimeWithinWindow } from '@/lib/dateUtils';

const EMPTY_FORM = { department_id: '', department_name: '', message: '', start_time: '00:00', end_time: '23:59' };

function formatTimeLabel(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export default function AutoResponseManager() {
  const [responses, setResponses] = useState([]);
  const [departments, setDepartments] = useState([]);
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
    const [r, allDepts, categories, templates] = await Promise.all([
      base44.entities.AutoResponse.list(),
      base44.entities.Department.filter({ is_active: true }),
      base44.entities.Category.filter({ is_active: true }),
      base44.entities.AuditTemplate.filter({ is_active: true, active_ticket: true }),
    ]);

    // A department can only receive a ticket if a manual ticket's category
    // routes to it (Category.department_id, non-audit-only) or an audit's
    // auto-ticket-on-NO feature matches it by name to a section title —
    // the same two lookups Ticket creation and Audit submission use.
    const manualDeptIds = new Set(
      categories.filter(c => !c.is_audit_only && c.department_id).map(c => c.department_id)
    );
    const sectionTitles = new Set(
      templates.flatMap(t => (t.sections || []).map(s => (s.title || '').trim().toLowerCase())).filter(Boolean)
    );
    const receivingDepts = allDepts.filter(d =>
      manualDeptIds.has(d.id) || sectionTitles.has((d.name || '').trim().toLowerCase())
    );

    setResponses(r);
    setDepartments(receivingDepts);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setForm({
      department_id: r.department_id || '',
      department_name: r.department_name || '',
      message: r.message,
      start_time: r.start_time || '00:00',
      end_time: r.end_time || '23:59',
    });
    setShowDialog(true);
  };

  const handleDeptChange = (val) => {
    const dept = departments.find(d => d.id === val);
    setForm(f => ({ ...f, department_id: val, department_name: dept?.name || '' }));
  };

  const handleSave = async () => {
    if (!form.department_id || !form.message.trim() || !form.start_time || !form.end_time) return;
    setSaving(true);
    const data = {
      department_id: form.department_id,
      department_name: form.department_name,
      message: form.message.trim(),
      start_time: form.start_time,
      end_time: form.end_time,
    };
    if (editing) {
      await base44.entities.AutoResponse.update(editing.id, data);
    } else {
      await base44.entities.AutoResponse.create({ ...data, is_active: true });
    }
    setSaving(false);
    setShowDialog(false);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.AutoResponse.delete(id);
    setDeleteId(null);
    load();
  };

  const toggleActive = async (r) => {
    await base44.entities.AutoResponse.update(r.id, { is_active: !r.is_active });
    load();
  };

  const filtered = responses.filter(r => filterDept === 'all' || r.department_id === filterDept);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Filter by department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openAdd} className="w-full gap-2 bg-[#1fd655] font-bold text-slate-900 hover:bg-[#1bd64d] sm:w-auto sm:ml-auto">
          <Plus className="w-4 h-4" /> Add Auto Response
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="p-12 text-center text-slate-500">
            <p className="font-medium">No auto responses found.</p>
            <p className="text-sm mt-1">Click "Add Auto Response" to set one up for a department.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const activeNow = r.is_active && isTimeWithinWindow(r.start_time, r.end_time);
            return (
              <Card key={r.id} className={`border-2 ${r.is_active ? 'border-slate-200' : 'border-slate-100'} hover:border-[#1fd655]/40 transition-colors`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex-1 min-w-0 ${r.is_active ? '' : 'opacity-60'}`}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className="bg-blue-100 text-blue-700 border-0 gap-1 text-xs">
                          <Building2 className="w-3 h-3" /> {r.department_name}
                        </Badge>
                        <Badge className="bg-slate-100 text-slate-600 border-0 gap-1 text-xs">
                          <Clock className="w-3 h-3" /> {formatTimeLabel(r.start_time)} – {formatTimeLabel(r.end_time)}
                        </Badge>
                        {!r.is_active && <Badge variant="outline" className="text-xs text-slate-400">Inactive</Badge>}
                        {r.is_active && (
                          <Badge className={`text-xs border-0 ${activeNow ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {activeNow ? 'Active now' : 'Outside window'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2 whitespace-pre-wrap">{r.message}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={() => toggleActive(r)}
                        className="mr-1 data-[state=checked]:bg-[#1fd655] data-[state=unchecked]:bg-slate-300"
                      />
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
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Auto Response' : 'New Auto Response'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Department <span className="text-red-500">*</span></label>
              <Select value={form.department_id} onValueChange={handleDeptChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department..." />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Active from <span className="text-red-500">*</span></label>
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Active until <span className="text-red-500">*</span></label>
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 -mt-2">A ticket received in this department during this window gets this message posted automatically as a comment. If the end time is earlier than the start time, the window crosses midnight.</p>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Auto Response Message <span className="text-red-500">*</span></label>
              <Textarea
                placeholder="e.g. Thanks for reaching out — our team is currently offline and will respond during business hours."
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={5}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.department_id || !form.message.trim() || !form.start_time || !form.end_time}
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
            <DialogTitle>Delete Auto Response?</DialogTitle>
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
