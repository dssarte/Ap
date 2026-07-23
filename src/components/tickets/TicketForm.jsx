import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send, Image, X } from "lucide-react";
import { compressImage } from '@/lib/compressImage';
import { getUserDisplayName } from '@/lib/userDisplayName';

export default function TicketForm({ user, onSuccess, onCancel }) {
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department_id: '',
    category_id: '',
    priority: 'medium',
    attachment_url: '',
    image_urls: [],
    assigned_to: ''
  });

  const isStaff = user.user_type === 'admin' || user.user_type === 'department_head';
  const isRegularUser = user.user_type === 'user';

  useEffect(() => {
    loadDepartments();
    loadCategories();
    if (isStaff) {
      loadUsers();
    }
  }, []);

  useEffect(() => {
    if (isStaff && formData.department_id) {
      loadUsers();
    }
  }, [formData.department_id]);

  const loadDepartments = async () => {
    try { setDepartments(await base44.entities.Department.filter({ is_active: true })); }
    catch (error) { console.error('Failed to load departments:', error); setDepartments([]); }
  };

  const loadCategories = async () => {
    let cats = [];
    try { cats = await base44.entities.Category.filter({ is_active: true }); }
    catch (error) { console.error('Failed to load categories:', error); }
    // Ensure we have all fields including department_id
    const categoriesWithDept = cats.filter(c => !c.is_audit_only).map(c => ({
      ...c,
      department_id: c.department_id || null,
      department_name: c.department_name || ''
    }));
    setCategories(categoriesWithDept);
  };

  const loadUsers = async () => {
    let allUsers = [];
    try { allUsers = await base44.entities.User.list(); }
    catch (error) { console.error('Failed to load users:', error); setUsers([]); return; }
    
    // Filter based on user type and department
    let filtered = allUsers.filter(u => 
      u.user_type === 'admin' || 
      u.user_type === 'department_head' || 
      u.user_type === 'staff'
    );

    // Department heads can only assign to their department
    if (user.user_type === 'department_head' && formData.department_id) {
      filtered = filtered.filter(u => u.department_id === formData.department_id);
    }

    // Admin can assign to users in the selected department
    if (user.user_type === 'admin' && formData.department_id) {
      filtered = filtered.filter(u => u.department_id === formData.department_id);
    }

    setUsers(filtered);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    setUploadError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, attachment_url: file_url });
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadError(error?.message || 'Upload failed.');
    }
    setUploading(false);
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    if (formData.image_urls.length + files.length > 5) {
      setUploadError('A ticket can include up to 5 images.');
      return;
    }
    
    setUploadingImages(true);
    setUploadError('');
    try {
      const uploadPromises = files.map(async file => {
        const compressed = await compressImage(file);
        return base44.integrations.Core.UploadFile({ file: compressed });
      });
      const results = await Promise.all(uploadPromises);
      const imageUrls = results.map(r => r.file_url);
      setFormData({ ...formData, image_urls: [...formData.image_urls, ...imageUrls] });
    } catch (error) {
      console.error('Image upload failed:', error);
      setUploadError(error?.message || 'Image upload failed.');
    }
    setUploadingImages(false);
  };

  const removeImage = (index) => {
    setFormData({
      ...formData,
      image_urls: formData.image_urls.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const title = formData.title.trim();
      const description = formData.description.trim();
      const effectiveDeptId = formData.department_id || user.department_id;
      if (!title || !description) throw new Error('Title and description are required.');
      if (!effectiveDeptId) throw new Error('Please select a department.');
      if (!formData.category_id) throw new Error('Please select a category.');
      const dept = departments.find(d => d.id === effectiveDeptId);
      if (!dept) throw new Error('The selected department is invalid or inactive.');
      
      // Fetch fresh category data to ensure department_id is correct
      let cat = null;
      if (formData.category_id) {
        cat = await base44.entities.Category.get(formData.category_id);
      }
      
      // Find an approver from the SUBMITTER's department (not the ticket department)
      let approver = { approver_email: '', approver_name: '' };
      try {
        const result = await base44.functions.invoke('findApproverForDepartment', { department_id: user.department_id });
        approver = result.data;
      } catch (e) {
        console.warn('Could not find approver:', e);
      }
      
      const newTicket = await base44.tickets.createManual({
        title,
        description,
        department_id: effectiveDeptId,
        department_name: dept?.name || user.department_name || '',
        category_id: formData.category_id,
        category_name: cat?.name || '',
        handling_department_id: cat?.department_id || effectiveDeptId,
        handling_department_name: cat?.department_name || dept?.name || user.department_name || '',
        priority: formData.priority,
        attachment_url: formData.attachment_url,
        image_urls: formData.image_urls,
        submitter_email: user.email,
        submitter_name: getUserDisplayName(user),
        store_name: user.store_name || '',
        // The database routes this to an enabled Department Head approver,
        // preserves store-manager approval when applicable, or opens it
        // immediately when no approval path exists.
        status: 'pending_approval',
        approval_status: 'pending',
        approver_email: approver?.approver_email || '',
        approver_name: approver?.approver_name || '',
        assigned_to: formData.assigned_to || null,
        handling_history: [],
        escalated: false,
        sla_response_breached: false,
        sla_resolution_breached: false,
      });

      // Notify the approver/staff immediately and apply any configured rules.
      await base44.functions.invoke('sendTicketNotification', {
        ticket_id: newTicket.id,
        type: 'created',
        message: `New ticket created: ${title}`,
      }).catch((notificationError) => {
        console.warn('Ticket saved, but participant notification delivery failed:', notificationError);
      });

      // Apply automation rules
      try {
        await base44.functions.invoke('applyTicketRules', { ticket_id: newTicket.id });
      } catch (e) {
        console.warn('Rules engine skipped:', e);
      }

      onSuccess?.();
    } catch (err) {
      console.error('Failed to submit ticket:', err);
      alert('Failed to submit ticket: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex h-[100dvh] max-h-[100dvh] flex-col rounded-none border-0 bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-xl sm:border-2 sm:border-slate-200">
      <CardHeader className="flex-shrink-0 border-b border-slate-100 bg-gradient-to-r from-[#1fd655]/5 to-transparent px-4 pb-4 pt-5 sm:px-6">
        <CardTitle className="text-xl font-bold text-slate-900 sm:text-2xl">Create new ticket</CardTitle>
      </CardHeader>
      <CardContent className="overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-slate-900 font-semibold text-sm">Title *</Label>
            <Input
              placeholder="Brief description of your issue"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="border-slate-300 focus:border-[#1fd655] focus:ring-[#1fd655] h-11"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-slate-900 font-semibold text-sm">Department *</Label>
            <Select
              value={formData.department_id}
              onValueChange={(value) => setFormData({ ...formData, department_id: value })}
              required
            >
              <SelectTrigger className="border-slate-300 h-11 focus:border-[#1fd655] focus:ring-[#1fd655]">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-900 font-semibold text-sm">Category *</Label>
            <Select
              value={formData.category_id}
              onValueChange={async (value) => {
                const cat = categories.find(c => c.id === value);
                const updates = { category_id: value };
                // Auto-set department if the category has a linked department
                if (cat?.department_id) {
                  updates.department_id = cat.department_id;
                  // Also fetch fresh category data to ensure department_id is correct
                  try {
                    const freshCat = await base44.entities.Category.get(value);
                    if (freshCat?.department_id) {
                      updates.department_id = freshCat.department_id;
                    }
                  } catch (e) {
                    console.warn('Could not fetch fresh category:', e);
                  }
                }
                setFormData(prev => ({ ...prev, ...updates }));
              }}
              required
            >
              <SelectTrigger className="border-slate-300 h-11 focus:border-[#1fd655] focus:ring-[#1fd655]">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-slate-900 font-semibold text-sm">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger className="border-slate-300 h-11 focus:border-[#1fd655] focus:ring-[#1fd655]">
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


          
          <div className="space-y-2">
            <Label className="text-slate-900 font-semibold text-sm">Description *</Label>
            <Textarea
              placeholder="Please describe your issue in detail..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              rows={5}
              className="border-slate-300 focus:border-[#1fd655] focus:ring-[#1fd655] resize-none"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-slate-900 font-semibold text-sm">Attachment (optional)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="file"
                onChange={handleFileUpload}
                className="border-slate-300"
                disabled={uploading}
              />
              {uploading && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
            </div>
            {formData.attachment_url && (
              <p className="text-xs text-green-600 font-medium">✓ File uploaded successfully</p>
            )}
            {uploadError && <p className="text-xs font-medium text-red-600" role="alert">{uploadError}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-slate-900 font-semibold text-sm">Images (optional)</Label>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="flex-1">
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-[#1fd655] transition-colors">
                    <Image className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600 font-medium">Click to upload images</p>
                    <p className="text-xs text-slate-500 mt-1">Up to 5 PNG/JPG images, 10MB each</p>
                  </div>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImages}
                  />
                </label>
              </div>
              
              {uploadingImages && (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading images...
                </div>
              )}
              
              {formData.image_urls.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {formData.image_urls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img 
                        src={url} 
                        alt={`Upload ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border-2 border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-slate-100 bg-white/95 px-4 pb-[max(.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={loading} 
              className="flex-1 bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold h-11 shadow-lg hover:shadow-xl transition-all"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Ticket
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
