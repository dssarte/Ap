import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Users, Loader2, UserPlus, Trash2, MailCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import MultiStoreSelect from "@/components/admin/MultiStoreSelect";

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [brands, setBrands] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ user_type: 'user', department_id: '', phone: '', brand_id: '', store_name: '', assigned_stores: [], is_approver: false, is_enabled: true });
  const [addData, setAddData] = useState({ email: '', full_name: '', password: '', role: 'user', user_type: 'user', department_id: '', brand_id: '', store_name: '', phone: '', assigned_stores: [], is_approver: false, is_enabled: true });
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // user to delete
  const [deleting, setDeleting] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, pendingData, deptsData, brandsData, storesData] = await Promise.all([
        base44.entities.User.list('-created_date'),
        base44.entities.PendingUser.list('-created_date'),
        base44.entities.Department.list(),
        base44.entities.Brand.filter({ is_active: true }),
        base44.entities.Store.filter({ is_active: true })
      ]);
      const pendingAsRows = pendingData.map(p => ({ ...p, full_name: p.full_name, _isPending: true }));
      setUsers([...pendingAsRows, ...usersData]);
      setDepartments(deptsData);
      setBrands(brandsData);
      setStores(storesData);
    } catch (err) {
      console.error('Failed to load users:', err);
      toast({ title: "Failed to load users", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dept = departments.find(d => d.id === formData.department_id);

      if (editing._isPending) {
        await base44.entities.PendingUser.update(editing.id, {
          full_name: formData.display_name?.trim() || null,
          user_type: formData.user_type,
          department_id: formData.department_id || null,
          department_name: dept?.name || null,
          store_name: formData.store_name || null,
          assigned_stores: formData.user_type === 'store_manager' ? (formData.assigned_stores || []) : [],
          is_approver: formData.user_type === 'department_head' && formData.is_approver,
          phone: formData.phone
        });
        await loadData();
        setEditDialogOpen(false);
        setEditing(null);
        return;
      }

      const updateData = {
        user_type: formData.user_type,
        role: formData.user_type === 'admin' ? 'admin' : 'user',
        phone: formData.phone,
        department_id: formData.department_id || null,
        department_name: dept?.name || null,
        // Store managers use assigned_stores exclusively. Keeping the legacy
        // single-store field would make an unassigned manager look assigned.
        store_name: formData.user_type === 'store_manager' ? null : (formData.store_name || null),
        brand_id: formData.user_type === 'store_manager' ? null : (formData.brand_id || null),
        assigned_stores: formData.user_type === 'store_manager' ? (formData.assigned_stores || []) : [],
        is_approver: formData.user_type === 'department_head' && formData.is_approver,
        display_name: formData.display_name?.trim() || null
      };
      
      await base44.entities.User.update(editing.id, updateData);

      const wasEnabled = !(editing.disabled === true || String(editing.disabled).toLowerCase() === 'true');
      if (formData.is_enabled !== wasEnabled) {
        await base44.functions.invoke('manageUser', {
          action: 'set_enabled',
          user_id: editing.id,
          enabled: formData.is_enabled,
        });
      }

      // Update verification status via service-role backend function
      const wasVerified = !!(editing.is_verified || editing.email_verified || editing.verified || editing.is_email_verified);
      if (formData.is_verified !== wasVerified) {
        await base44.functions.invoke('setUserVerified', { user_id: editing.id, verified: formData.is_verified });
      }

      await loadData();
      setEditDialogOpen(false);
      setEditing(null);
      toast({ title: "User updated", description: `${editing.email} was updated successfully.` });
    } catch (err) {
      console.error('Failed to update user:', err);
      alert('Failed to save: ' + (err?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const sendVerificationEmail = async (toEmail, toName) => {
    const verifyUrl = `${window.location.origin}/verify?email=${encodeURIComponent(toEmail)}`;
    await base44.integrations.Core.SendEmail({
      to: toEmail,
      subject: 'ACTION REQUIRED: Verify Your HelpDesk Account',
      body: `Hello ${toName || ''},

Here is how to verify your HelpDesk account:

STEP 1 — Find the "Verify your email" email
  Check your inbox (and spam/junk folder) for an email with subject "Verify your email".
  It contains a 6-digit verification code that looks like: 7 8 4 6 9 7
  Copy that code.

STEP 2 — Click the link below and paste the code
  ${verifyUrl}

  The page will open directly to the code entry field.
  Paste your 6-digit code and click Verify — done!

--
Thank you,
HelpDesk Support Team`
    });
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddError('');
    setSaving(true);
    try {
      const dept = departments.find(d => d.id === addData.department_id);
      // Use backend function — inviteUser doesn't send OTP, only an invite link
      const res = await base44.functions.invoke('initializeNewUser', {
        email: addData.email,
        password: addData.password,
        full_name: addData.full_name,
        user_type: addData.user_type,
        role: addData.role,
        brand_id: addData.user_type === 'store_manager' ? null : (addData.brand_id || null),
        department_id: addData.department_id || null,
        department_name: dept?.name || null,
        store_name: addData.user_type === 'store_manager' ? null : (addData.store_name || null),
        phone: addData.phone || null,
        assigned_stores: addData.user_type === 'store_manager' ? addData.assigned_stores : [],
        is_approver: addData.user_type === 'department_head' && addData.is_approver,
        enabled: addData.is_enabled,
      });
      if (res.data?.error) throw new Error(res.data.error);
      // Keep the checkbox functional even while the updated Edge Function is
      // being deployed: the signed-in administrator may update the new profile.
      if (res.data?.profile?.id) {
        await base44.entities.User.update(res.data.profile.id, {
          is_approver: addData.user_type === 'department_head' && addData.is_approver,
        });
      }
      const savedEmail = addData.email;
      const savedEnabled = addData.is_enabled;
      setInviteDialogOpen(false);
      setAddData({ email: '', full_name: '', password: '', role: 'user', user_type: 'user', department_id: '', brand_id: '', store_name: '', phone: '', assigned_stores: [], is_approver: false, is_enabled: true });
      await loadData();
      toast({
        title: "User created",
        description: savedEnabled
          ? `${savedEmail} can now sign in with the temporary password.`
          : `${savedEmail} was created but remains disabled until an administrator enables it.`,
      });
    } catch (err) {
      console.error('Failed to add user:', err);
      setAddError(err?.message || 'Failed to create user. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (user) => {
    setEditing(user);
    // Try to find the brand_id from the user's current store_name
    const matchedStore = stores.find(s => s.store_name === user.store_name);
    setFormData({
      display_name: user.display_name || user.full_name || '',
      user_type: user.user_type === 'approver' ? 'department_head' : (user.user_type || 'user'),
      department_id: user.department_id || '', 
      phone: user.phone || '',
      brand_id: matchedStore?.brand_id || '',
      store_name: user.store_name || '',
      assigned_stores: user.assigned_stores || [],
      is_approver: user.user_type === 'approver' || user.is_approver === true,
      is_verified: !!(user.is_verified || user.email_verified || user.verified || user.is_email_verified),
      is_enabled: !(user.disabled === true || String(user.disabled).toLowerCase() === 'true')
    });
    setEditDialogOpen(true);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (deleteConfirm._isPending) {
        await base44.entities.PendingUser.delete(deleteConfirm.id);
      } else {
        await base44.functions.invoke('manageUser', {
          action: 'delete',
          user_id: deleteConfirm.id,
        });
      }
      const removedEmail = deleteConfirm.email;
      setDeleteConfirm(null);
      await loadData();
      toast({ title: "User removed", description: `${removedEmail} can no longer sign in.` });
    } catch (err) {
      toast({ title: "Failed to remove user", description: err?.message || 'Unknown error', variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const isDisabled = (user) => user.disabled === true || String(user.disabled).toLowerCase() === 'true';

  const handleResendVerification = async (user) => {
    setResendingEmail(user.id);
    try {
      await sendVerificationEmail(user.email, user.display_name || user.full_name);
      toast({ title: "Verification email sent", description: `Instructions sent to ${user.email}` });
    } catch (err) {
      toast({ title: "Failed to send", description: err?.message || "Could not send verification email", variant: "destructive" });
    } finally {
      setResendingEmail(null);
    }
  };

  const getRoleBadge = (user) => {
    if (user.user_type === 'admin') {
      return <Badge className="bg-purple-100 text-purple-700 border-0 font-semibold uppercase text-xs">Admin</Badge>;
    }
    if (user.user_type === 'department_head') {
      return <Badge className="bg-blue-100 text-blue-700 border-0 font-semibold uppercase text-xs">{user.is_approver ? 'Dept Head • Approver' : 'Dept Head'}</Badge>;
    }
    if (user.user_type === 'approver') return <Badge className="bg-amber-100 text-amber-700 border-0 font-semibold uppercase text-xs">Dept Head • Approver</Badge>;
    if (user.user_type === 'store_manager') {
      return <Badge className="bg-teal-100 text-teal-700 border-0 font-semibold uppercase text-xs">Store Manager</Badge>;
    }
    return <Badge className="bg-slate-100 text-slate-600 border-0 font-semibold uppercase text-xs">User</Badge>;
  };

  return (
    <Card className="border-2 border-slate-200 shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
        <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
          <Users className="w-6 h-6 text-[#1fd655]" />
          Users
        </CardTitle>
        <Dialog open={inviteDialogOpen} onOpenChange={(open) => { setInviteDialogOpen(open); if (!open) setAddError(''); }}>
          <DialogTrigger asChild>
            <Button className="bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold shadow-md hover:shadow-lg">
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="space-y-3 mt-2">
              {addError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">{addError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Full Name</Label>
                  <Input
                    value={addData.full_name}
                    onChange={(e) => setAddData({ ...addData, full_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={addData.email}
                    onChange={(e) => setAddData({ ...addData, email: e.target.value })}
                    placeholder="user@example.com"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Password *</Label>
                <Input
                  type="password"
                  value={addData.password}
                  onChange={(e) => setAddData({ ...addData, password: e.target.value })}
                  placeholder="Set a password for this user"
                  required
                  minLength={6}
                />
                <p className="text-xs text-slate-500">The user can change their password after logging in.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>System Role *</Label>
                  <Select value={addData.role} onValueChange={(v) => setAddData({ ...addData, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>User Category *</Label>
                  <Select value={addData.user_type} onValueChange={(v) => setAddData({ ...addData, user_type: v, is_approver: v === 'department_head' ? addData.is_approver : false })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="department_head">Department Head</SelectItem>
                      <SelectItem value="store_manager">Store Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {addData.user_type === 'department_head' && (
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Can approve tickets</p>
                    <p className="text-xs text-slate-600">Send new tickets from users in this department to this Department Head for approval.</p>
                  </div>
                  <Checkbox
                    checked={addData.is_approver}
                    onCheckedChange={(value) => setAddData({ ...addData, is_approver: value === true })}
                    aria-label="Allow this department head to approve tickets"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Department</Label>
                  <Select value={addData.department_id} onValueChange={(v) => setAddData({ ...addData, department_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input
                    value={addData.phone}
                    onChange={(e) => setAddData({ ...addData, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
              </div>
              {addData.user_type !== 'store_manager' && <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Brand</Label>
                  <Select value={addData.brand_id} onValueChange={(v) => setAddData({ ...addData, brand_id: v, store_name: '' })}>
                    <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                    <SelectContent>
                      {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Store</Label>
                  <Select value={addData.store_name} onValueChange={(v) => setAddData({ ...addData, store_name: v })} disabled={!addData.brand_id}>
                    <SelectTrigger><SelectValue placeholder={addData.brand_id ? "Select store" : "Select brand first"} /></SelectTrigger>
                    <SelectContent>
                      {stores.filter(s => s.brand_id === addData.brand_id).map(s => (
                        <SelectItem key={s.id} value={s.store_name}>{s.store_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>}
              {addData.user_type === 'store_manager' && (
                <div className="space-y-2">
                  <MultiStoreSelect
                    stores={stores.filter(store => store.is_active !== false)}
                    brands={brands.filter(brand => brand.is_active !== false)}
                    selected={addData.assigned_stores}
                    onChange={(vals) => setAddData({ ...addData, assigned_stores: vals })}
                  />
                  <p className="text-xs text-slate-500">Only selected active stores are visible in approvals, audits, and analytics. No selection means no operational access.</p>
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Account Access</p>
                  <p className="text-xs text-slate-500">Turn off to create the user without allowing sign-in yet.</p>
                </div>
                <Switch
                  checked={addData.is_enabled}
                  onCheckedChange={(val) => setAddData({ ...addData, is_enabled: val })}
                  aria-label="Enable new account access"
                />
              </div>
              <Button type="submit" disabled={saving} className="w-full bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold h-11 mt-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                {saving ? 'Creating User...' : 'Add User'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
          <div className="space-y-3 md:hidden">
            {users.map(user => (
              <article key={user.id} className={`rounded-xl border border-slate-200 p-4 shadow-sm ${isDisabled(user) ? 'bg-slate-50 opacity-75' : 'bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h3 className="truncate font-semibold text-slate-900">{user.display_name || user.full_name || '-'}</h3><p className="mt-0.5 break-all text-xs text-slate-500">{user.email}</p></div>
                  {getRoleBadge(user)}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div><dt className="text-xs text-slate-400">Department</dt><dd className="mt-0.5 text-slate-700">{user.department_name || '-'}</dd></div>
                  <div><dt className="text-xs text-slate-400">Phone</dt><dd className="mt-0.5 text-slate-700">{user.phone || '-'}</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-slate-400">Store</dt><dd className="mt-0.5 text-slate-700">{user.user_type === 'store_manager' ? (user.assigned_stores?.length ? user.assigned_stores.join(', ') : '-') : (user.store_name || '-')}</dd></div>
                </dl>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  {user._isPending
                    ? <Badge className="border-0 bg-amber-100 text-xs font-semibold text-amber-700">Pending</Badge>
                    : isDisabled(user)
                      ? <Badge className="border-0 bg-slate-200 text-xs font-semibold text-slate-700">Disabled</Badge>
                      : <Badge className="border-0 bg-green-100 text-xs font-semibold text-green-700">Active</Badge>}
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(user)} aria-label={`Edit ${user.display_name || user.full_name || user.email}`}><Pencil className="h-4 w-4" /></Button>
                    {!user._isPending && <Button variant="ghost" size="icon" className="text-blue-500 hover:bg-blue-50 hover:text-blue-700" onClick={() => handleResendVerification(user)} disabled={resendingEmail === user.id} aria-label={`Resend verification to ${user.email}`}>{resendingEmail === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}</Button>}
                    <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50 hover:text-red-700" onClick={() => setDeleteConfirm(user)} aria-label={`Permanently remove ${user.display_name || user.full_name || user.email}`} title="Permanently remove user"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </article>
            ))}
            {users.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No users yet</p>}
          </div>
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id} className={isDisabled(user) ? 'bg-slate-50 opacity-75' : ''}>
                  <TableCell className="font-medium">{user.display_name || user.full_name || '-'}</TableCell>
                  <TableCell className="text-slate-600">{user.email}</TableCell>
                  <TableCell>{getRoleBadge(user)}</TableCell>
                  <TableCell className="text-slate-600">{user.department_name || '-'}</TableCell>
                  <TableCell className="text-slate-600">
                    {user.user_type === 'store_manager'
                      ? (user.assigned_stores?.length ? user.assigned_stores.join(', ') : '-')
                      : (user.store_name || '-')}
                  </TableCell>
                  <TableCell className="text-slate-600">{user.phone || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      {user._isPending
                        ? <Badge className="bg-amber-100 text-amber-700 border-0 text-xs font-semibold">Pending</Badge>
                        : isDisabled(user)
                          ? <Badge className="bg-slate-200 text-slate-700 border-0 text-xs font-semibold">Disabled</Badge>
                          : <Badge className="bg-green-100 text-green-700 border-0 text-xs font-semibold">Active</Badge>}
                      {!user._isPending && (
                        <span className="text-xs text-slate-500">
                          {(user.is_verified || user.email_verified || user.verified || user.is_email_verified) ? 'Verified' : 'Unverified'}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {!user._isPending && (
                        <Button
                          variant="ghost" size="icon"
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleResendVerification(user)}
                          disabled={resendingEmail === user.id}
                          title="Resend verification email"
                        >
                          {resendingEmail === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailCheck className="w-4 h-4" />}
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteConfirm(user)} title="Permanently remove user" aria-label={`Permanently remove ${user.display_name || user.full_name || user.email}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                    No users yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
          </>
        )}
      </CardContent>
      
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleEdit} className="space-y-4 mt-4">
              <div className="text-sm text-slate-600 mb-4">
                ({editing.email})
              </div>
              <div className="space-y-2">
                <Label className="text-slate-900 font-semibold">Display Name</Label>
                <Input
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="Display name"
                  className="border-slate-300 h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-900 font-semibold">User Category *</Label>
                <Select
                  value={formData.user_type}
                  onValueChange={(value) => setFormData({ ...formData, user_type: value, is_approver: value === 'department_head' ? formData.is_approver : false })}
                >
                  <SelectTrigger className="border-slate-300 h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User - Can create tickets</SelectItem>
                    <SelectItem value="department_head">Department Head - Process tickets</SelectItem>
                    <SelectItem value="store_manager">Store Manager - Multi-store approvals & analytics</SelectItem>
                    <SelectItem value="admin">Admin - Full access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.user_type === 'department_head' && (
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Can approve tickets</p>
                    <p className="text-xs text-slate-600">When enabled, new tickets from this department are sent to this Department Head’s Approval Queue.</p>
                  </div>
                  <Checkbox
                    checked={formData.is_approver}
                    onCheckedChange={(value) => setFormData({ ...formData, is_approver: value === true })}
                    aria-label="Allow this department head to approve tickets"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label className="text-slate-900 font-semibold">Department</Label>
                <Select
                  value={formData.department_id}
                  onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                >
                  <SelectTrigger className="border-slate-300 h-11">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.user_type === 'department_head' && (
                  <p className="text-xs text-slate-500">Department heads can only process tickets for their assigned department</p>
                )}
              </div>

              {formData.user_type !== 'store_manager' && <>
              <div className="space-y-2">
                <Label className="text-slate-900 font-semibold">Brand</Label>
                <Select
                  value={formData.brand_id || '__none__'}
                  onValueChange={(value) => setFormData({ ...formData, brand_id: value === '__none__' ? '' : value, store_name: '' })}
                >
                  <SelectTrigger className="border-slate-300 h-11">
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No brand assigned</SelectItem>
                    {brands.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-900 font-semibold">Store Name</Label>
                <Select
                  value={formData.store_name || '__none__'}
                  onValueChange={(value) => setFormData({ ...formData, store_name: value === '__none__' ? '' : value, brand_id: value === '__none__' ? '' : formData.brand_id })}
                >
                  <SelectTrigger className="border-slate-300 h-11">
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No store assigned</SelectItem>
                    {stores.filter(s => !formData.brand_id || s.brand_id === formData.brand_id).map(s => (
                      <SelectItem key={s.id} value={s.store_name}>{s.store_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">Select "No store assigned" to remove the store from this user (e.g. approvers/department heads).</p>
              </div>
              </>}
              {formData.user_type === 'store_manager' && (
                <div className="space-y-2">
                  <MultiStoreSelect
                    stores={stores.filter(store => store.is_active !== false)}
                    brands={brands.filter(brand => brand.is_active !== false)}
                    selected={formData.assigned_stores}
                    onChange={(vals) => setFormData({ ...formData, assigned_stores: vals })}
                  />
                  <p className="text-xs text-slate-500">Only selected active stores are visible in approvals, audits, and analytics. Leave all stores unselected to remove operational access.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-slate-900 font-semibold">Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Phone number"
                  className="border-slate-300 h-11"
                />
              </div>
              {editing?._isPending ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  This user hasn't logged in yet — no account exists until they do, and no verification email has been sent.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Account Access</p>
                      <p className="text-xs text-slate-500">Disabled users cannot sign in. Their history is preserved.</p>
                    </div>
                    <Switch
                      checked={formData.is_enabled}
                      onCheckedChange={(val) => setFormData({ ...formData, is_enabled: val })}
                      aria-label="Enable account access"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Account Verified</p>
                      <p className="text-xs text-slate-500">Allow this user to log in without email verification</p>
                    </div>
                    <Switch
                      checked={formData.is_verified}
                      onCheckedChange={(val) => setFormData({ ...formData, is_verified: val })}
                      aria-label="Mark account as verified"
                    />
                  </div>
                </div>
              )}
              <Button type="submit" disabled={saving} className="w-full bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold h-11 shadow-md hover:shadow-lg">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update User'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Permanent removal confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Permanently remove user</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Remove <strong>{deleteConfirm?.display_name || deleteConfirm?.full_name || deleteConfirm?.email}</strong>? Their login and user profile will be permanently deleted. Historical tickets and audits will remain. This cannot be undone.
          </p>
          <DialogFooter className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remove user'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
