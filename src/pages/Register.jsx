import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Headphones, CheckCircle, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Register() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    department_id: '',
    user_type: 'user',
    password: '',
    confirm_password: ''
  });
  const [departments, setDepartments] = useState([]);
  const [open, setOpen] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const depts = await base44.entities.Department.filter({ is_active: true });
      setDepartments(depts);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!agreedToTerms) {
      setError('You must agree to the Terms & Conditions and Privacy Policy');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (!formData.department_id) {
      setError('Please select a department/store');
      setLoading(false);
      return;
    }

    try {
      // Check if user is authenticated
      const isAuth = await base44.auth.isAuthenticated();
      
      if (isAuth) {
        // User just registered and is now authenticated
        const dept = departments.find(d => d.id === formData.department_id);
        
        // Always default to 'user'; only the hardcoded admin email gets admin role
        const userType = formData.email === 'dennissarte@gmail.com' ? 'admin' : 'user';
        
        await base44.auth.updateMe({
          phone: formData.phone,
          user_type: userType,
          department_id: formData.department_id,
          department_name: dept?.name || ''
        });
        
        setSuccess(true);
        
        // Redirect to home after 2 seconds
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        // Store data in sessionStorage for after auth
        sessionStorage.setItem('pendingRegistration', JSON.stringify({
          phone: formData.phone,
          department_id: formData.department_id,
          department_name: departments.find(d => d.id === formData.department_id)?.name
        }));
        
        // Trigger the login/register flow
        base44.auth.redirectToLogin(window.location.origin);
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  const selectedDepartment = departments.find(d => d.id === formData.department_id);

  if (success) {
    return (
      <div className="app-page min-h-[calc(100vh-5rem)] flex items-center justify-center">
        <Card className="w-full max-w-md rounded-2xl border border-slate-200 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-[#1fd655] flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Welcome to HelpDesk!</h2>
            <p className="text-slate-600">
              Your account has been created successfully. Redirecting to dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-page min-h-[calc(100vh-5rem)] flex items-center justify-center">
      <Card className="w-full max-w-md rounded-2xl border border-slate-200 shadow-sm">
        <CardHeader className="space-y-4 text-center border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
          <div className="w-16 h-16 rounded-2xl bg-[#1fd655] flex items-center justify-center mx-auto shadow-lg">
            <Headphones className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold text-slate-900">
            Create Account
          </CardTitle>
          <p className="text-slate-600">Join our HelpDesk support system</p>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-900 font-semibold text-sm">Full Name *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
                required
                className="border-slate-300 focus:border-[#1fd655] focus:ring-[#1fd655] h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-900 font-semibold text-sm">Email Address *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                required
                className="border-slate-300 focus:border-[#1fd655] focus:ring-[#1fd655] h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-900 font-semibold text-sm">Contact Number *</Label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1234567890"
                required
                className="border-slate-300 focus:border-[#1fd655] focus:ring-[#1fd655] h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-900 font-semibold text-sm">Department/Store *</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-11 border-slate-300 hover:border-[#1fd655] font-normal"
                  >
                    {selectedDepartment ? selectedDepartment.name : "Select department..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search department..." className="h-9" />
                    <CommandEmpty>No department found.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {departments.map((dept) => (
                        <CommandItem
                          key={dept.id}
                          value={dept.name}
                          onSelect={() => {
                            setFormData({ ...formData, department_id: dept.id });
                            setOpen(false);
                          }}
                        >
                          {dept.name}
                          <Check
                            className={cn(
                              "ml-auto h-4 w-4",
                              formData.department_id === dept.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-900 font-semibold text-sm">Password *</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Minimum 6 characters"
                required
                className="border-slate-300 focus:border-[#1fd655] focus:ring-[#1fd655] h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-900 font-semibold text-sm">Confirm Password *</Label>
              <Input
                type="password"
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                placeholder="Re-enter password"
                required
                className="border-slate-300 focus:border-[#1fd655] focus:ring-[#1fd655] h-11"
              />
            </div>

            <div className="flex items-start space-x-3 pt-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={setAgreedToTerms}
                className="mt-1 border-slate-300 data-[state=checked]:bg-[#1fd655] data-[state=checked]:border-[#1fd655]"
              />
              <label
                htmlFor="terms"
                className="text-sm text-slate-600 leading-relaxed cursor-pointer"
              >
                By checking the box, you agree to our{' '}
                <a href="#" className="text-[#1fd655] font-semibold hover:underline">
                  Terms & Conditions
                </a>{' '}
                and{' '}
                <a href="#" className="text-[#1fd655] font-semibold hover:underline">
                  Privacy Policy
                </a>
                .
              </label>
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 text-sm text-red-600 font-medium">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold h-12 shadow-lg hover:shadow-xl transition-all"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Create Account'
              )}
            </Button>

            <div className="text-center text-sm text-slate-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => base44.auth.redirectToLogin()}
                className="text-[#1fd655] font-semibold hover:underline"
              >
                Sign In
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
