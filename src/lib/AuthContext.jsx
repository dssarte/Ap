import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const authenticated = await base44.auth.isAuthenticated();
      if (!authenticated) {
        setUser(null);
        setIsAuthenticated(false);
        return;
      }
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: error?.message || 'Authentication required' });
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setTimeout(checkUserAuth, 0);
      }
    });
    return () => subscription.unsubscribe();
  }, [checkUserAuth]);

  // Keep store assignments current while a branch manager is signed in.
  // Database RLS changes immediately; this subscription keeps navigation and
  // empty-state gating in sync without requiring a manual browser refresh.
  useEffect(() => {
    if (!user?.id) return undefined;

    const channel = supabase
      .channel(`current-profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.id}` },
        ({ new: updatedProfile }) => {
          if (!updatedProfile?.id) return;
          setUser({
            ...updatedProfile,
            email: updatedProfile.email?.trim().toLowerCase(),
            assigned_stores: Array.isArray(updatedProfile.assigned_stores)
              ? updatedProfile.assigned_stores
              : [],
          });
        },
      )
      .subscribe();

    const refreshVisibleProfile = () => {
      if (document.visibilityState === 'visible') {
        base44.auth.me().then(setUser).catch(() => {});
      }
    };
    window.addEventListener('focus', refreshVisibleProfile);
    document.addEventListener('visibilitychange', refreshVisibleProfile);

    return () => {
      window.removeEventListener('focus', refreshVisibleProfile);
      document.removeEventListener('visibilitychange', refreshVisibleProfile);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    await base44.auth.logout(shouldRedirect);
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: { id: 'supabase-local', public_settings: {} },
      logout,
      navigateToLogin: () => window.location.replace('/login'),
      checkAppState: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
