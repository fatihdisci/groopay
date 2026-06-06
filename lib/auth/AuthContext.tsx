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
    // With implicit flow (default on native due to no WebCrypto/SHA256):
    //   groopay://auth/callback#access_token=...&refresh_token=...
    // With PKCE flow (if WebCrypto is available):
    //   groopay://auth/callback?code=...
    // We handle both, with implicit as the primary path on native.
    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        'groopay://auth/callback',
      );

      if (result.type === 'success' && result.url) {
        // Debug: log callback URL structure for diagnosis
        const urlPreview = result.url.length > 200
          ? result.url.slice(0, 200) + '…'
          : result.url;
        console.log('[auth] OAuth callback URL:', urlPreview);
        console.log('[auth] Has query (?):', result.url.includes('?'));
        console.log('[auth] Has fragment (#):', result.url.includes('#'));

        // ── Implicit flow (primary on native) ──
        // Tokens in fragment: groopay://auth/callback#access_token=...&refresh_token=...
        const fragmentMatch = result.url.match(/#(.*)$/);
        const fragment = fragmentMatch ? fragmentMatch[1] : '';
        const accessTokenMatch = fragment.match(/access_token=([^&]+)/);
        const refreshTokenMatch = fragment.match(/refresh_token=([^&]+)/);

        // ── PKCE fallback ──
        // Code in query: groopay://auth/callback?code=...
        const codeMatch = result.url.match(/[?&]code=([^&#]+)/);
        const code = codeMatch ? decodeURIComponent(codeMatch[1]) : null;

        if (accessTokenMatch && refreshTokenMatch) {
          console.log('[auth] Implicit flow: setting session from fragment tokens…');
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: decodeURIComponent(accessTokenMatch[1]),
            refresh_token: decodeURIComponent(refreshTokenMatch[1]),
          });
          if (setSessionError) {
            console.error('[auth] setSession failed:', setSessionError.message);
            throw setSessionError;
          }
          console.log('[auth] Implicit session established');
        } else if (code) {
          console.log('[auth] PKCE fallback: exchanging code for session (5s timeout)…');
          // Wrap in a timeout — exchangeCodeForSession can hang if PKCE
          // code_challenge method = plain is rejected by the server.
          const exchangePromise = supabase.auth.exchangeCodeForSession(code);
          const timeoutPromise = new Promise<{ timedOut: true }>((resolve) =>
            setTimeout(() => resolve({ timedOut: true }), 5000),
          );
          const exchangeResult = await Promise.race([exchangePromise, timeoutPromise]);

          if ('timedOut' in exchangeResult) {
            console.error('[auth] PKCE exchangeCodeForSession timed out after 5s');
            throw new Error('Oturum açma zaman aşımına uğradı. Lütfen tekrar deneyin.');
          }

          const { error: exchangeError } = exchangeResult;
          if (exchangeError) {
            console.error('[auth] PKCE exchange failed:', exchangeError.message);
            throw exchangeError;
          }
          console.log('[auth] PKCE session established');
        } else {
          // No recognizable auth params — try getSession as last resort
          console.warn('[auth] No code or tokens in callback URL — trying getSession…');
          const { data: sessionCheck } = await supabase.auth.getSession();
          if (sessionCheck.session) {
            console.log('[auth] Session found via getSession (already established)');
          } else {
            console.warn('[auth] No session established after OAuth callback');
          }
        }

        // onAuthStateChange fires SIGNED_IN → profile loaded → index.tsx redirects
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
