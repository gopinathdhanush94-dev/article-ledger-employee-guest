import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';

const ROLE_PERMISSIONS = {
  super_admin: {
    canView: true, canViewGeneral: true, canViewGarments: true, canViewAddProduct: true,
    canAdd: true, canEdit: true, canDelete: true, canHistory: true,
    canViewShowroom: true, canManageShowroom: true,
    canDataQuality: true, canManageUsers: true, canManageQuotations: true,
  },
  admin: {
    canView: true, canViewGeneral: true, canViewGarments: true, canViewAddProduct: true,
    canAdd: true, canEdit: true, canDelete: true, canHistory: true,
    canViewShowroom: true, canManageShowroom: true,
    canDataQuality: true, canManageUsers: true, canManageQuotations: true,
  },
  quotation_manager: {
    canView: true, canViewGeneral: true, canViewGarments: true, canViewAddProduct: true,
    canAdd: false, canEdit: false, canDelete: false, canHistory: true,
    canViewShowroom: true, canManageShowroom: true,
    canDataQuality: false, canManageUsers: false, canManageQuotations: true,
  },
  guest_manager: {
    canView: true, canViewGeneral: true, canViewGarments: true, canViewAddProduct: true,
    canAdd: false, canEdit: false, canDelete: false, canHistory: true,
    canViewShowroom: true, canManageShowroom: true,
    canDataQuality: false, canManageUsers: false, canManageQuotations: false,
  },
  editor: {
    canView: true, canViewGeneral: true, canViewGarments: true, canViewAddProduct: true,
    canAdd: true, canEdit: true, canDelete: false, canHistory: true,
    canViewShowroom: false, canManageShowroom: false,
    canDataQuality: false, canManageUsers: false, canManageQuotations: false,
  },
  viewer: {
    canView: true, canViewGeneral: true, canViewGarments: true, canViewAddProduct: false,
    canAdd: false, canEdit: false, canDelete: false, canHistory: true,
    canViewShowroom: false, canManageShowroom: false,
    canDataQuality: false, canManageUsers: false, canManageQuotations: false,
  },
  guest: {
    canView: false, canViewGeneral: false, canViewGarments: false, canViewAddProduct: false,
    canAdd: false, canEdit: false, canDelete: false, canHistory: false,
    canViewShowroom: false, canManageShowroom: false,
    canDataQuality: false, canManageUsers: false, canManageQuotations: false,
  },
};

const DEFAULT_PERMISSIONS = ROLE_PERMISSIONS.viewer;

export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId, attempts = 3) => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, email, employee_id, account_type, role, status, created_at, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (data) {
        setProfile(data);
        return data;
      }
      if (error) console.error('Could not load account profile:', error);
      if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
    setProfile(null);
    return null;
  }, []);

  useEffect(() => {
    let mounted = true;
    let initialised = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const sess = data.session || null;
      setSession(sess);
      if (sess?.user?.id) await loadProfile(sess.user.id);
      else setProfile(null);
      if (mounted) {
        initialised = true;
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!mounted) return;
      setSession(sess || null);

      // Supabase emits TOKEN_REFRESHED when the browser tab becomes active
      // and the access token is refreshed. This is NOT a new login and must
      // never put the access gate back into its loading/unmount state. Doing
      // so remounts AppInner/GuestShowroom and resets the current screen.
      if (event === 'TOKEN_REFRESHED') return;

      if (!sess) {
        setProfile(null);
        if (initialised) setLoading(false);
        return;
      }

      // Only authentication/profile-changing events need a profile refresh.
      // Keep the UI mounted during background auth activity.
      const shouldReloadProfile = event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION';
      if (!shouldReloadProfile) return;

      setLoading(true);
      Promise.resolve().then(async () => {
        await loadProfile(sess.user.id);
        if (mounted) setLoading(false);
      });
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  }

  async function signUp(email, password, metadata = {}) {
    return await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const role = profile?.role || (profile?.account_type === 'guest' ? 'guest' : 'viewer');
  const permissions = useMemo(() => ROLE_PERMISSIONS[role] || DEFAULT_PERMISSIONS, [role]);
  const isEmployee = profile?.account_type === 'employee';
  const isGuest = profile?.account_type === 'guest';
  const isActive = profile?.status === 'active';
  const isPending = profile?.status === 'pending';
  const isDisabled = profile?.status === 'disabled';

  return {
    session,
    profile,
    role,
    permissions,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile: () => loadProfile(session?.user?.id),
    isAuthed: !!session,
    isEmployee,
    isGuest,
    isActive,
    isPending,
    isDisabled,
  };
}

export { ROLE_PERMISSIONS };
