import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionUserIdRef = useRef(null);
  const profileRequestRef = useRef(0);
  const hydratedUserIdRef = useRef(null);
  const mountedRef = useRef(false);

  const loadProfile = useCallback(async (userId, { blockUi = false } = {}) => {
    if (!userId) {
      hydratedUserIdRef.current = null;
      setProfile(null);
      return null;
    }

    const requestId = ++profileRequestRef.current;
    if (blockUi) setLoading(true);

    let result = null;
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('user_id, full_name, email, employee_id, account_type, role, status, created_at, updated_at')
          .eq('user_id', userId)
          .maybeSingle();

        if (data) {
          result = data;
          break;
        }
        if (error) console.error('Could not load account profile:', error);
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    } finally {
      if (mountedRef.current && requestId === profileRequestRef.current) {
        setProfile(result);
        hydratedUserIdRef.current = userId;
        if (blockUi) setLoading(false);
      }
    }
    return result;
  }, []);

  const applySession = useCallback(async (nextSession, { forceProfileReload = false, blockUi = false } = {}) => {
    if (!mountedRef.current) return;

    const nextUserId = nextSession?.user?.id || null;
    const previousUserId = sessionUserIdRef.current;
    const sameUser = !!nextUserId && nextUserId === previousUserId;

    setSession(nextSession || null);
    sessionUserIdRef.current = nextUserId;

    if (!nextUserId) {
      ++profileRequestRef.current;
      hydratedUserIdRef.current = null;
      setProfile(null);
      setLoading(false);
      return;
    }

    // A token refresh or duplicate SIGNED_IN for the already-mounted user must
    // never block/unmount the application. The existing profile remains valid.
    if (sameUser && !forceProfileReload) {
      return;
    }

    await loadProfile(nextUserId, { blockUi });
  }, [loadProfile]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    // Subscribe once for the whole application. AccessGate and AppInner both
    // consume the same context instead of creating independent auth listeners.
    const { data: authSubscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled || !mountedRef.current) return;

      const nextUserId = nextSession?.user?.id || null;
      const sameUser = !!nextUserId && nextUserId === sessionUserIdRef.current;

      if (event === 'TOKEN_REFRESHED' || (event === 'SIGNED_IN' && sameUser)) {
        // Keep the current React tree mounted. Supabase has refreshed or
        // re-announced the same authenticated session; there is no access-gate
        // transition to perform.
        setSession(nextSession || null);
        sessionUserIdRef.current = nextUserId;
        return;
      }

      // INITIAL_SESSION and a genuine SIGNED_IN/user change may need profile
      // hydration. Only these transitions are allowed to block the gate.
      void applySession(nextSession, {
        forceProfileReload: event === 'SIGNED_IN',
        blockUi: true,
      });
    });

    // getSession is the authoritative initial snapshot. It may race with the
    // INITIAL_SESSION event above, so applySession treats the same user as an
    // already-known session and avoids duplicate UI transitions.
    supabase.auth.getSession()
      .then(({ data }) => {
        if (cancelled || !mountedRef.current) return;
        const nextSession = data?.session || null;
        const nextUserId = nextSession?.user?.id || null;
        const alreadyHydrated = nextUserId && nextUserId === hydratedUserIdRef.current;
        if (alreadyHydrated) {
          setSession(nextSession);
          setLoading(false);
          return;
        }
        return applySession(nextSession, { blockUi: !!nextUserId });
      })
      .catch(error => {
        console.error('Could not restore Supabase session:', error);
        if (!cancelled && mountedRef.current) {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      authSubscription.subscription.unsubscribe();
    };
  }, [applySession]);

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

  const value = useMemo(() => ({
    session,
    profile,
    role,
    permissions,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile: () => loadProfile(session?.user?.id, { blockUi: false }),
    isAuthed: !!session,
    isEmployee,
    isGuest,
    isActive,
    isPending,
    isDisabled,
  }), [session, profile, role, permissions, loading, loadProfile, isEmployee, isGuest, isActive, isPending, isDisabled]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}

export { ROLE_PERMISSIONS };
