import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase/client';
import { AVATAR_COLORS } from '@/constants/avatarColors';
import type { ProfileRow } from '@/lib/supabase/types';
import type { Profile } from './types';

// ──────────────────────────────────────
// TODO Phase 1B: link this anonymous user to real Google/Apple identity
// via supabase.auth.linkIdentity(). The screens only use useAuth(),
// so Phase 1B only touches THIS file.
// ──────────────────────────────────────

const STORAGE_KEY_ONBOARDED = 'groopay:onboarded';
const STORAGE_KEY_DEMO_GROUP = 'groopay:demo_group';

interface AuthContextValue {
  user: Profile | null;
  isLoading: boolean;
  isOnboarded: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<Profile, 'display_name' | 'avatar_color' | 'locale' | 'preferred_currency'>>) => Promise<void>;
  setOnboarded: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function profileRowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    display_name: row.display_name,
    avatar_color: row.avatar_color,
    locale: row.locale,
    preferred_currency: row.preferred_currency,
    user_pro: row.user_pro,
    user_pro_purchased_at: row.user_pro_purchased_at,
  };
}

async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.warn('[auth] Failed to fetch profile:', error.message);
    return null;
  }
  return data as ProfileRow;
}

// If user has zero groups, they are a fresh account — clear any stale
// onboarding flag left over from Phase 1A local storage.
async function syncOnboardingFlag(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('groups')
    .select('id')
    .eq('created_by', userId)
    .limit(1);

  if (!data || data.length === 0) {
    await AsyncStorage.removeItem(STORAGE_KEY_ONBOARDED);
    return false;
  }
  return true;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        const storedOnboarded = await AsyncStorage.getItem(STORAGE_KEY_ONBOARDED);
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          if (profile) {
            setUser(profileRowToProfile(profile));
          }
          // Only restore onboarding flag if user actually has groups
          const hasGroups = await syncOnboardingFlag(session.user.id);
          if (hasGroups && storedOnboarded === 'true') setIsOnboarded(true);
        }
      } catch (e) {
        console.warn('[auth] Failed to restore session:', e);
      } finally {
        setIsLoading(false);
      }
    })();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Wait a tick for the profiles trigger to fire
          await new Promise((r) => setTimeout(r, 200));
          const profile = await fetchProfile(session.user.id);
          if (profile) setUser(profileRowToProfile(profile));
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── ANONYMOUS SIGN-IN (TODO Phase 1B: linkIdentity to Google/Apple) ──
  const signIn = useCallback(async () => {
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      console.error('[auth] Anonymous sign-in failed:', error.message);
      throw error;
    }

    if (data.user) {
      // Trigger fires handle_new_user → profiles row created.
      // Give it a moment, then fetch.
      await new Promise((r) => setTimeout(r, 300));
      let profile = await fetchProfile(data.user.id);

      // Fallback: if trigger hasn't fired, create profile manually
      if (!profile) {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            display_name: 'Kullanıcı',
            avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!,
            locale: 'tr',
          })
          .select('*')
          .single();

        if (insertError) {
          console.error('[auth] Failed to create profile:', insertError.message);
          throw insertError;
        }
        profile = newProfile as ProfileRow;
      }

      setUser(profileRowToProfile(profile));

      // Clear stale onboarding flag for fresh accounts (Phase 1A → 2 migration)
      const hasGroups = await syncOnboardingFlag(data.user.id);
      if (!hasGroups) setIsOnboarded(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<Pick<Profile, 'display_name' | 'avatar_color' | 'locale' | 'preferred_currency'>>) => {
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: updates.display_name,
          avatar_color: updates.avatar_color,
          locale: updates.locale,
          preferred_currency: updates.preferred_currency,
        })
        .eq('id', user.id);

      if (error) {
        console.error('[auth] Failed to update profile:', error.message);
        throw error;
      }

      // Also update display_name in all group memberships
      if (updates.display_name) {
        const { error: gmError } = await supabase
          .from('group_members')
          .update({ display_name: updates.display_name })
          .eq('user_id', user.id);
        if (gmError) {
          console.warn('[auth] Failed to sync display_name to group_members:', gmError.message);
        }
      }

      const updated = { ...user, ...updates };
      setUser(updated);
    },
    [user],
  );

  const setOnboarded = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY_ONBOARDED, 'true');
    setIsOnboarded(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isOnboarded, signIn, signOut, updateProfile, setOnboarded }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { STORAGE_KEY_DEMO_GROUP, AVATAR_COLORS };
