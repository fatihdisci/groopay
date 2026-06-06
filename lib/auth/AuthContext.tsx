import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase/client';
import { AVATAR_COLORS } from '@/constants/avatarColors';
import type { ProfileRow } from '@/lib/supabase/types';
import type { Profile, OAuthProvider } from './types';

// ──────────────────────────────────────
// Faz 8: Anonymous auth replaced with Google + Apple OAuth.
// signInAnonymously() kept as fallback for Expo Go / dev builds.
// signInWithProvider() uses supabase.auth.signInWithOAuth().
// Anonymous → real: linkIdentity() upgrades existing session.
// ──────────────────────────────────────

const STORAGE_KEY_ONBOARDED = 'groopay:onboarded';
const STORAGE_KEY_DEMO_GROUP = 'groopay:demo_group';

interface AuthContextValue {
  user: Profile | null;
  isLoading: boolean;
  isOnboarded: boolean;
  signIn: () => Promise<void>; // legacy anonymous, dev fallback
  signInWithProvider: (provider: OAuthProvider) => Promise<void>;
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

  // ── GOOGLE / APPLE OAuth (Faz 8) ──
  const signInWithProvider = useCallback(async (provider: OAuthProvider) => {
    // Attempt to link identity if user is currently anonymous.
    // This upgrades the existing anonymous session to a real one,
    // preserving all data (groups, memberships, expenses).
    const { data: { session } } = await supabase.auth.getSession();
    const isAnonymous = session?.user?.is_anonymous ?? false;

    if (isAnonymous) {
      // Link the anonymous user to a real identity
      const { error: linkError } = await supabase.auth.linkIdentity({ provider });

      if (!linkError) {
        // Successfully linked — refresh profile (same user.id)
        await new Promise((r) => setTimeout(r, 300));
        const profile = await fetchProfile(session!.user.id);
        if (profile) {
          setUser(profileRowToProfile(profile));
        }
        return;
      }

      // linkIdentity can fail if the provider identity is already linked
      // to another account. Fall through to sign-in as a new user.
      console.log('[auth] linkIdentity failed, signing in as new user:', linkError.message);
    }

    // Standard OAuth sign-in (new or existing real account).
    // skipBrowserRedirect: true so we get the URL back and open it manually
    // via expo-web-browser — this is required on native (Expo).
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        skipBrowserRedirect: true,
        redirectTo: 'groopay://auth/callback',
      },
    });

    if (error) {
      console.error(`[auth] ${provider} sign-in failed:`, error.message);
      throw error;
    }

    // Open the OAuth URL in the system browser.
    // The provider redirects back to groopay://auth/callback → browser closes
    // → openAuthSessionAsync resolves with the callback URL.
    // We must manually exchange the code for a session because
    // skipBrowserRedirect: true means Supabase doesn't process the URL internally.
    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        'groopay://auth/callback',
      );

      if (result.type === 'success' && result.url) {
        // Extract the authorization code from the callback URL
        // Format: groopay://auth/callback?code=xxx...
        const codeMatch = result.url.match(/[?&]code=([^&#]+)/);
        const code = codeMatch ? decodeURIComponent(codeMatch[1]) : null;

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('[auth] Code exchange failed:', exchangeError.message);
            throw exchangeError;
          }
          // onAuthStateChange fires SIGNED_IN → profile loaded → index.tsx redirects
        } else {
          // No code in URL — the session might have been established another way
          const { data: sessionCheck } = await supabase.auth.getSession();
          if (!sessionCheck.session) {
            console.warn('[auth] No session established after OAuth callback');
          }
        }
      } else if (result.type === 'cancel') {
        console.log('[auth] OAuth browser cancelled by user');
      }
    }
  }, []);

  // ── ANONYMOUS SIGN-IN (dev fallback, Expo Go) ──
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
      value={{ user, isLoading, isOnboarded, signIn, signInWithProvider, signOut, updateProfile, setOnboarded }}
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
