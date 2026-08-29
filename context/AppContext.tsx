import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type HouseholdContextValue = {
  session: Session | null;
  user: User | null;
  householdId: string | null;
  householdName: string | null;
  memberName: string | null;
  loading: boolean;
  refreshHousehold: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AppContext = createContext<HouseholdContextValue | null>(null);

async function ensureHousehold(user: User) {
  const profileName =
    (user.user_metadata?.first_name as string | undefined) ||
    (user.email ? user.email.split('@')[0] : 'Utilisateur');

  await supabase.from('profiles').upsert({ id: user.id, first_name: profileName }, { onConflict: 'id' });

  const { data: membership, error: membershipError } = await supabase
    .from('household_members')
    .select('household_id, display_name')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;

  let householdId = membership?.household_id ?? null;
  let memberName = membership?.display_name ?? profileName;

  if (!householdId) {
    const { data: owned, error: ownedError } = await supabase
      .from('households')
      .select('id, name')
      .eq('created_by', user.id)
      .limit(1)
      .maybeSingle();
    if (ownedError) throw ownedError;

    if (owned?.id) {
      householdId = owned.id;
    } else {
      const { data: created, error: createError } = await supabase
        .from('households')
        .insert({ name: 'Mon foyer', created_by: user.id })
        .select('id')
        .single();
      if (createError) throw createError;
      householdId = created.id;
    }

    const { error: memberError } = await supabase.from('household_members').insert({
      household_id: householdId,
      user_id: user.id,
      display_name: profileName,
      member_type: 'adult',
      portion_factor: 1,
      kcal_visible: true,
    });
    if (memberError && !memberError.message.toLowerCase().includes('duplicate')) throw memberError;
  }

  const { data: household, error: householdError } = await supabase
    .from('households')
    .select('name')
    .eq('id', householdId)
    .single();
  if (householdError) throw householdError;

  return { householdId, householdName: household.name, memberName };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setHouseholdId(null);
      setHouseholdName(null);
      setMemberName(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ctx = await ensureHousehold(currentSession.user);
      setHouseholdId(ctx.householdId);
      setHouseholdName(ctx.householdName);
      setMemberName(ctx.memberName);
    } catch (e) {
      console.error('Household bootstrap failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshHousehold = useCallback(async () => {
    await bootstrap(session);
  }, [bootstrap, session]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    bootstrap(session);
  }, [session?.user?.id, bootstrap]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      householdId,
      householdName,
      memberName,
      loading,
      refreshHousehold,
      signOut,
    }),
    [session, householdId, householdName, memberName, loading, refreshHousehold, signOut],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
