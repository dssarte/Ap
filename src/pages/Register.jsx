import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, CheckCircle, ChevronsUpDown, Loader2, UserRoundCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Register() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    department_id: '',
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const initialize = async () => {
      try {
        const [user, activeDepartments] = await Promise.all([
          base44.auth.me(),
          base44.entities.Department.filter({ is_active: true }),
        ]);
        setCurrentUser(user);
        setDepartments(Array.isArray(activeDepartments) ? activeDepartments : []);
        setFormData({
          full_name: user.full_name || user.display_name || '',
          email: user.email || '',
          phone: user.phone || '',
          department_id: user.department_id || '',
        });
      } catch (err) {
        setError(err?.message || 'Unable to load your profile. Please sign in again.');
      } finally {
        setInitializing(false);
      }
    };

    initialize();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!formData.full_name.trim()) {
      setError('Full name is required.');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Contact number is required.');
      return;
    }
    if (!formData.department_id) {
      setError('Please select a department or store.');
      return;
    }

    setSaving(true);
    try {
      const selectedDepartment = departments.find((department) => department.id === formData.department_id);
      const updates = {
        full_name: formData.full_name.trim(),
        display_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
      };

      // Non-admin users may choose their department only while completing a
      // brand-new profile. Existing role/access assignments remain admin-only.
      if (!currentUser?.department_id) {
        updates.department_id = formData.department_id;
        updates.department_name = selectedDepartment?.name || '';
      }

      await base44.auth.updateMe(updates);
      setSuccess(true);
      window.setTimeout(() => window.location.replace('/'), 1200);
    } catch (err) {
      setError(err?.message || 'Profile update failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const selectedDepartment = departments.find((department) => department.id === formData.department_id);
  const departmentLocked = Boolean(currentUser?.department_id);

  if (initializing) {
    return (
      <div className="app-page flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" aria-label="Loading profile" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="app-page flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <Card className="w-full max-w-md rounded-2xl border border-slate-200 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500">
              <CheckCircle className="h-10 w-10 text-white" />
            </div>
            <h2 className="mb-3 text-2xl font-bold text-slate-900">Profile completed</h2>
            <p className="text-slate-600">Your profile was saved. Redirecting to the dashboard…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-page flex min-h-[calc(100vh-5rem)] items-center justify-center py-8">
      <Card className="w-full max-w-md rounded-2xl border border-slate-200 shadow-sm">
        <CardHeader className="space-y-4 border-b bg-gradient-to-r from-emerald-500/5 to-transparent text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg">
            <UserRoundCheck className="h-8 w-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold text-slate-900">Complete your profile</CardTitle>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Update your contact details. Account roles and access are managed by an administrator.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="profile-name" className="text-sm font-semibold text-slate-900">Full name *</Label>
              <Input
                id="profile-name"
                value={formData.full_name}
                onChange={(event) => setFormData({ ...formData, full_name: event.target.value })}
                placeholder="John Doe"
                required
                className="h-11 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-email" className="text-sm font-semibold text-slate-900">Email address</Label>
              <Input
                id="profile-email"
                type="email"
                value={formData.email}
                disabled
                className="h-11 border-slate-200 bg-slate-100 text-slate-600"
              />
              <p className="text-xs text-slate-500">Contact an administrator to change your account email.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-phone" className="text-sm font-semibold text-slate-900">Contact number *</Label>
              <Input
                id="profile-phone"
                type="tel"
                value={formData.phone}
                onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                placeholder="+639171234567"
                required
                className="h-11 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-900">Department/Store *</Label>
              <Popover open={departmentOpen && !departmentLocked} onOpenChange={setDepartmentOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={departmentOpen}
                    disabled={departmentLocked}
                    className="h-11 w-full justify-between border-slate-300 font-normal hover:border-emerald-500"
                  >
                    {selectedDepartment?.name || currentUser?.department_name || 'Select department…'}
                    {!departmentLocked && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search department…" className="h-9" />
                    <CommandEmpty>No department found.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {departments.map((department) => (
                        <CommandItem
                          key={department.id}
                          value={department.name}
                          onSelect={() => {
                            setFormData({ ...formData, department_id: department.id });
                            setDepartmentOpen(false);
                          }}
                        >
                          {department.name}
                          <Check className={cn('ml-auto h-4 w-4', formData.department_id === department.id ? 'opacity-100' : 'opacity-0')} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              {departmentLocked && <p className="text-xs text-slate-500">Only an administrator can change an existing department assignment.</p>}
            </div>

            {error && (
              <div role="alert" className="rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" disabled={saving} className="h-12 w-full bg-emerald-700 font-bold text-white shadow-lg hover:bg-emerald-800">
              {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              {saving ? 'Saving profile…' : 'Save profile'}
            </Button>

            <Button type="button" variant="ghost" className="w-full" onClick={() => window.location.replace('/')}>
              Return to dashboard
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
