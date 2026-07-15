import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    department_id: '',
    department_name: '',
    is_active: true,
    is_audit_only: false
  });

  useEffect(() => {
    loadCategories();
    loadDepartments();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    const data = await base44.entities.Category.list('-created_date');
    setCategories(data);
    setLoading(false);
  };

  const loadDepartments = async () => {
    const data = await base44.entities.Department.filter({ is_active: true });
    setDepartments(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if department changed for existing category
    const departmentChanged = editingCategory && editingCategory.department_id !== formData.department_id;
    const oldDeptId = editingCategory?.department_id;
    
    if (editingCategory) {
      await base44.entities.Category.update(editingCategory.id, formData);
      
      // If department changed, update existing tickets using this category
      if (departmentChanged) {
        try {
          const tickets = await base44.entities.Ticket.filter({ category_id: editingCategory.id });
          
          if (tickets.length > 0) {
            await base44.entities.Ticket.bulkUpdate(
              tickets.map(t => ({
                id: t.id,
                handling_department_id: formData.department_id || t.department_id,
                handling_department_name: formData.department_name || t.department_name
              }))
            );
            console.log(`Updated ${tickets.length} tickets for category department change`);
          }
        } catch (ticketErr) {
          console.warn('Failed to update tickets:', ticketErr);
        }
      }
    } else {
      await base44.entities.Category.create(formData);
    }
    
    setDialogOpen(false);
    setEditingCategory(null);
    setFormData({ name: '', description: '', department_id: '', department_name: '', is_active: true, is_audit_only: false });
    loadCategories();
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      department_id: category.department_id || '',
      department_name: category.department_name || '',
      is_active: category.is_active,
      is_audit_only: category.is_audit_only || false
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this category?')) {
      await base44.entities.Category.delete(id);
      loadCategories();
    }
  };

  const handleToggleActive = async (category) => {
    await base44.entities.Category.update(category.id, { is_active: !category.is_active });
    loadCategories();
  };

  return (
    <Card className="border-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-bold">Ticket Categories</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900"
              onClick={() => {
                setEditingCategory(null);
                setFormData({ name: '', description: '', department_id: '', department_name: '', is_active: true, is_audit_only: false });
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Category Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Hardware Issue"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Linked Department</Label>
                <Select
                  value={formData.department_id || 'none'}
                  onValueChange={(value) => {
                    const dept = departments.find(d => d.id === value);
                    setFormData({ ...formData, department_id: value === 'none' ? '' : value, department_name: dept?.name || '' });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (user selects department)</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">When set, selecting this category will auto-route the ticket to this department.</p>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this category"
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Audit Only</Label>
                  <p className="text-xs text-slate-500">Only appears in audit forms, not in ticket creation</p>
                </div>
                <Switch
                  checked={formData.is_audit_only}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_audit_only: checked })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900">
                  {editingCategory ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center py-8 text-slate-500">Loading categories...</p>
        ) : categories.length === 0 ? (
          <p className="text-center py-8 text-slate-500">No categories yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Linked Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">
                    {category.name}
                    {category.is_audit_only && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">Audit Only</span>}
                  </TableCell>
                  <TableCell>
                    {category.department_name
                      ? <Badge className="bg-blue-100 text-blue-700 border-0">{category.department_name}</Badge>
                      : <span className="text-slate-400 text-sm">None</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={category.is_active ? 'default' : 'secondary'}>
                      {category.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(category)}
                      >
                        <Switch checked={category.is_active} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(category)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(category.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}