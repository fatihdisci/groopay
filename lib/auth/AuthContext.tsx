import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  supabase,
  setSupabaseAccessToken,
  STORAGE_KEY_ACCESS_TOKEN,
  STORAGE_KEY_REFRESH_TOKEN,
} from '@/lib/supabase/client';
import { AVATAR_COLORS } from '@/constants/avatarColors';
import type { ProfileRow } from '@/lib/supabase/types';
import type { Profile, OAuthProvider } from './types';

// ──────────────────────────────────────
// Faz 8: Anonymous auth replaced with Google + Apple OAuth.
//
// Token strategy (June 2026):
//   setSession/getSession HANG on React Native (supabase-js bug).
//   We use the accessToken callback in createClient — it injects
//   Authorization: Bearer <token> on every request without needing
//   a Supabase session. auth.uid() works via the JWT sub claim.
//   setSession/getSession are NEVER called.
// ──────────────────────────────────────

const STORAGE_KEY_ONBOARDED = 'groopay:onboarded';
const STORAGE_KEY_DEMO_GROUP = 'groopay:demo_group';

interface AuthContextValue {
  user: Profile | null;
  isLoading: boolean;
  isOnboarded: boolean;
  signIn: () => Promise<void>;
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

  // ── Restore session on mount (cold start) ──
  useEffect(() => {
    (async () => {
      try {
        console.log('[auth] Cold start: restoring token from storage…');
        const storedToken = await AsyncStorage.getItem(STORAGE_KEY_ACCESS_TOKEN);

        if (storedToken) {
          // Set the token so accessToken callback uses it
          setSupabaseAccessToken(storedToken);

          // Verify the token is still valid
          const { data: userData, error: userError } = await supabase.auth.getUser(storedToken);

          if (userError || !userData?.user) {
            console.log('[auth] Stored token expired, clearing…');
            setSupabaseAccessToken(null);
            await AsyncStorage.multiRemove([STORAGE_KEY_ACCESS_TOKEN, STORAGE_KEY_REFRESH_TOKEN]);
          } else {
            console.log('[auth] Token valid, user:', userData.user.id);
            const profile = await fetchProfile(userData.user.id);
            if (profile) {
              setUser(profileRowToProfile(profile));
            }

            const storedOnboarded = await AsyncStorage.getItem(STORAGE_KEY_ONBOARDED);
            const hasGroups = await syncOnboardingFlag(userData.user.id);
            if (hasGroups && storedOnboarded === 'true') setIsOnboarded(true);
          }
        } else {
          console.log('[auth] No stored token — user must sign in');
        }
      } catch (e) {
        console.warn('[auth] Session restore failed:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── GOOGLE / APPLE OAuth ──
  const signInWithProvider = useCallback(async (provider: OAuthProvider) => {
    // Attempt to link identity if user is currently anonymous
    const { data: { session } } = await supabase.auth.getSession();
    const isAnonymous = session?.user?.is_anonymous ?? false;

    if (isAnonymous) {
      const { error: linkError } = await supabase.auth.linkIdentity({ provider });
      if (!linkError) {
        await new Promise((r) => setTimeout(r, 300));
        const profile = await fetchProfile(session!.user.id);
        if (profile) setUser(profileRowToProfile(profile));
        return;
      }
      console.log('[auth] linkIdentity failed, signing in as new user:', linkError.message);
    }

    // Standard OAuth sign-in
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

    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, 'groopay://auth/callback');

      if (result.type === 'success' && result.url) {
        const urlPreview = result.url.length > 200 ? result.url.slice(0, 200) + '…' : result.url;
        console.log('[auth] OAuth callback URL:', urlPreview);

        // Parse tokens from fragment: groopay://auth/callback#access_token=...&...
        const hashIndex = result.url.indexOf('#');
        if (hashIndex < 0) {
          console.warn('[auth] No fragment in callback URL');
          return;
        }

        const fragment = result.url.slice(hashIndex + 1);
        console.log('[auth] All fragment params:', fragment);

        const params = new URLSearchParams(fragment);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const expires_in = params.get('expires_in');
        const token_type = params.get('token_type');

        console.log('[auth] Token preview — access:', access_token?.substring(0, 20) + '…');
        console.log('[auth] Token preview — refresh:', refresh_token?.substring(0, 20) + '…');
        console.log('[auth] expires_in:', expires_in, 'token_type:', token_type);

        if (!access_token) {
          console.warn('[auth] No access_token in fragment');
          return;
        }

        // ── Step 1: verify token ──
        console.log('[auth] Step 1: getUser…');
        const { data: userData, error: userError } = await supabase.auth.getUser(access_token);
        if (userError || !userData?.user) {
          const msg = userError?.message ?? 'No user returned';
          console.error('[auth] getUser failed:', msg);
          throw new Error(msg);
        }
        console.log('[auth] getUser OK, user:', userData.user.id);

        // ── Step 2: set token via callback → all subsequent requests use it ──
        // This is the CRITICAL step. The accessToken callback in createClient
        // returns this token on every request → auth.uid() = JWT sub → RLS works.
        console.log('[auth] Step 2: setSupabaseAccessToken → auth.uid() now works');
        setSupabaseAccessToken(access_token);

        // ── Step 3: persist tokens for cold start ──
        await AsyncStorage.setItem(STORAGE_KEY_ACCESS_TOKEN, access_token);
        if (refresh_token) {
          await AsyncStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, refresh_token);
        }
        console.log('[auth] Tokens persisted to AsyncStorage');

        // ── Step 4: fetch profile (RLS now passes because auth.uid() = user.id) ──
        console.log('[auth] Step 4: fetch profile…');
        let profile = await fetchProfile(userData.user.id);

        if (profile) {
          setUser(profileRowToProfile(profile));
          console.log('[auth] Profile loaded:', profile.display_name);
        } else {
          // handle_new_user trigger (migration 0015) may not have fired yet
          console.log('[auth] Profile not in DB yet — in-memory fallback + retry');
          const fallbackName =
            userData.user.user_metadata?.full_name ??
            userData.user.user_metadata?.name ??
            'Kullanıcı';
          const fallbackColor =
            AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;

          setUser({
            id: userData.user.id,
            display_name: fallbackName,
            avatar_color: fallbackColor,
            locale: 'tr',
            preferred_currency: null,
            user_pro: false,
            user_pro_purchased_at: null,
          });

          setTimeout(async () => {
            const retry = await fetchProfile(userData.user.id);
            if (retry) {
              setUser(profileRowToProfile(retry));
              console.log('[auth] Retry: profile loaded from DB');
            }
          }, 1500);
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
      await new Promise((r) => setTimeout(r, 300));
      let profile = await fetchProfile(data.user.id);

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

      const hasGroups = await syncOnboardingFlag(data.user.id);
      if (!hasGroups) setIsOnboarded(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    // Clear our token holder
    setSupabaseAccessToken(null);
    // Clear stored tokens
    await AsyncStorage.multiRemove([
      STORAGE_KEY_ACCESS_TOKEN,
      STORAGE_KEY_REFRESH_TOKEN,
      STORAGE_KEY_ONBOARDED,
    ]);
    // Also sign out from Supabase (for anonymous sessions)
    await supabase.auth.signOut().catch(() => {});
    setUser(null);
    setIsOnboarded(false);
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
