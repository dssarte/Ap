import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/api/supabaseClient';

// Shown when someone signs in with a login that has no Users row
// (currentProfile throws 'user_not_registered'). They stay signed in until
// they press Sign out, so this screen shows every time they open the app.
const UserNotRegisteredError = () => {
  const { logout } = useAuth();
  const [email, setEmail] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setEmail(data.session?.user?.email || ''))
      .catch(() => {});
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout(true);
    } catch {
      window.location.replace('/login');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100">
            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Access Restricted</h1>
          <p className="text-slate-600">
            This login isn&apos;t set up in the app yet. Please ask an administrator to give you access.
          </p>
          {email && (
            <p className="mt-2 text-sm text-slate-500">
              Signed in as <span className="font-medium text-slate-700">{email}</span>
            </p>
          )}
          <div className="mt-8 p-4 bg-slate-50 rounded-md text-sm text-slate-600">
            <p>If you believe this is an error, you can:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Verify you are logged in with the correct account</li>
              <li>Contact the app administrator for access</li>
            </ul>
          </div>
          <Button className="mt-6 w-full" onClick={signOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
