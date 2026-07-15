import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Plus, Trash2, Loader2 } from "lucide-react";

export default function AuditAssignmentManager() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ user_id: '', template_id: '' });
  const [saving, setSaving] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');

  useEffect(() => {
    base44.auth.me().then(u => setAdminEmail(u?.email || '')).catch(() => {});
  }, []);

  const { data: users = [] } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => base44.entities.User.list('full_name'),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['audit-templates-all'],
    queryFn: () => base44.entities.AuditTemplate.filter({ is_active: true }, 'title', 100),
  });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['audit-assignments'],
    queryFn: () => base44.entities.AuditAssignment.list('-created_date', 200),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AuditAssignment.delete(id),
    onSuccess: () => qc.invalidateQueries(['audit-assignments']),
  });

  const handleSave = async () => {
    if (!form.user_id || !form.template_id) return;
    setSaving(true);
    const user = users.find(u => u.id === form.user_id);
    const template = templates.find(t => t.id === form.template_id);
    // Check for duplicate
    const exists = assignments.find(a => a.user_email === user?.email && a.template_id === form.template_id && a.is_active);
    if (exists) {
      alert('This user is already assigned to this template.');
      setSaving(false);
      return;
    }
    await base44.entities.AuditAssignment.create({
      user_email: user?.email,
      user_name: user?.full_name || user?.email,
      template_id: form.template_id,
      template_title: template?.title,
      store_name: user?.store_name || '',
      assigned_by: adminEmail,
      is_active: true,
    });
    qc.invalidateQueries(['audit-assignments']);
    setDialogOpen(false);
    setForm({ user_id: '', template_id: '' });
    setSaving(false);
  };

  // QA users only (department QA or user_type user)
  const qaUsers = users.filter(u => 
    u.department_name === 'Quality Assurance' || u.user_type === 'admin'
      ? true
      : u.user_type === 'user' || u.department_name?.toLowerCase().includes('quality')
  );

  return (
    <Card className="border-2 border-slate-200 shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
        <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
          <ClipboardList className="w-6 h-6 text-[#1fd655]" />
          Audit Assignments
        </CardTitle>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold shadow-md">
          <Plus className="w-4 h-4 mr-2" /> Assign Template
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned By</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 py-10">
                    No assignments yet. Click "Assign Template" to get started.
                  </TableCell>
                </TableRow>
              )}
              {assignments.map(a => (
                <TableRow key={a.id}>
                  <TableCell>
                    <p className="font-medium text-slate-900">{a.user_name || a.user_email}</p>
                    <p className="text-xs text-slate-500">{a.user_email}</p>
                  </TableCell>
                  <TableCell className="text-slate-600">{a.store_name || '—'}</TableCell>
                  <TableCell className="font-medium">{a.template_title}</TableCell>
                  <TableCell>
                    <Badge className={a.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">{a.assigned_by || '—'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => { if (confirm('Remove this assignment?')) deleteMutation.mutate(a.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Audit Template to User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>User</Label>
              <Select value={form.user_id} onValueChange={v => setForm(f => ({ ...f, user_id: v }))}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select user..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      <span>{u.full_name || u.email}</span>
                      {u.store_name && <span className="text-slate-400 ml-2 text-xs">({u.store_name})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.user_id && users.find(u => u.id === form.user_id)?.store_name && (
                <p className="text-xs text-blue-600">Store: {users.find(u => u.id === form.user_id)?.store_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Audit Template</Label>
              <Select value={form.template_id} onValueChange={v => setForm(f => ({ ...f, template_id: v }))}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.user_id || !form.template_id}
              className="bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}