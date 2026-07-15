import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function SLAManager() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingSLA, setEditingSLA] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 'medium',
    department_id: '',
    response_time_hours: 2,
    resolution_time_hours: 24,
    escalate_after_hours: '',
    escalation_email: '',
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: slas = [], isLoading } = useQuery({
    queryKey: ['slas'],
    queryFn: () => base44.entities.SLA.list('-created_date')
  });

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    const depts = await base44.entities.Department.filter({ is_active: true });
    setDepartments(depts);
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SLA.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['slas']);
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SLA.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['slas']);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SLA.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['slas'])
  });

  const handleSubmit = () => {
    const submitData = {
      ...formData,
      response_time_hours: Number(formData.response_time_hours),
      resolution_time_hours: Number(formData.resolution_time_hours),
      escalate_after_hours: formData.escalate_after_hours ? Number(formData.escalate_after_hours) : null,
      department_id: formData.department_id || null
    };

    if (editingSLA) {
      updateMutation.mutate({ id: editingSLA.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (sla) => {
    setEditingSLA(sla);
    setFormData({
      name: sla.name,
      description: sla.description || '',
      priority: sla.priority,
      department_id: sla.department_id || '',
      response_time_hours: sla.response_time_hours,
      resolution_time_hours: sla.resolution_time_hours,
      escalate_after_hours: sla.escalate_after_hours || '',
      escalation_email: sla.escalation_email || '',
      is_active: sla.is_active
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      priority: 'medium',
      department_id: '',
      response_time_hours: 2,
      resolution_time_hours: 24,
      escalate_after_hours: '',
      escalation_email: '',
      is_active: true
    });
    setEditingSLA(null);
    setShowDialog(false);
  };

  const priorityColors = {
    low: 'bg-slate-100 text-slate-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700'
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          SLA Policies
        </CardTitle>
        <Button onClick={() => setShowDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add SLA Policy
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center py-8 text-slate-500">Loading...</p>
        ) : slas.length === 0 ? (
          <p className="text-center py-8 text-slate-500">No SLA policies yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Response Time</TableHead>
                <TableHead>Resolution Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slas.map(sla => (
                <TableRow key={sla.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{sla.name}</p>
                      {sla.description && (
                        <p className="text-xs text-slate-500">{sla.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={priorityColors[sla.priority]}>
                      {sla.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {sla.department_id 
                      ? departments.find(d => d.id === sla.department_id)?.name || 'Unknown'
                      : 'All Departments'}
                  </TableCell>
                  <TableCell>{sla.response_time_hours}h</TableCell>
                  <TableCell>{sla.resolution_time_hours}h</TableCell>
                  <TableCell>
                    <Badge variant={sla.is_active ? 'default' : 'secondary'}>
                      {sla.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(sla)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(sla.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSLA ? 'Edit' : 'Create'} SLA Policy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Policy Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Critical Priority SLA"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Describe when this policy applies..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority Level</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({...formData, priority: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department (Optional)</Label>
                <Select value={formData.department_id} onValueChange={(v) => setFormData({...formData, department_id: v === '__all__' ? '' : v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Response Time (hours)</Label>
                <Input
                  type="number"
                  value={formData.response_time_hours}
                  onChange={(e) => setFormData({...formData, response_time_hours: e.target.value})}
                  min="0.5"
                  step="0.5"
                />
              </div>
              <div>
                <Label>Resolution Time (hours)</Label>
                <Input
                  type="number"
                  value={formData.resolution_time_hours}
                  onChange={(e) => setFormData({...formData, resolution_time_hours: e.target.value})}
                  min="1"
                  step="1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Escalate After (hours, optional)</Label>
                <Input
                  type="number"
                  value={formData.escalate_after_hours}
                  onChange={(e) => setFormData({...formData, escalate_after_hours: e.target.value})}
                  placeholder="e.g., 12"
                  min="1"
                />
              </div>
              <div>
                <Label>Escalation Email (optional)</Label>
                <Input
                  type="email"
                  value={formData.escalation_email}
                  onChange={(e) => setFormData({...formData, escalation_email: e.target.value})}
                  placeholder="manager@example.com"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!formData.name || !formData.response_time_hours || !formData.resolution_time_hours}>
              {editingSLA ? 'Update' : 'Create'} Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}