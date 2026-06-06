import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import {
  supabase,
  supabaseAuth,
  setSupabaseAccessToken,
  STORAGE_KEY_ACCESS_TOKEN,
  STORAGE_KEY_REFRESH_TOKEN,
} from '@/lib/supabase/client';
import { AVATAR_COLORS } from '@/constants/avatarColors';
import type { ProfileRow } from '@/lib/supabase/types';
import type { Profile, OAuthProvider } from './types';

// ──────────────────────────────────────
// Faz 8: Google + Apple OAuth and production guest auth.
//
// Token strategy (June 2026):
//   The DB client never uses Supabase session APIs. Its accessToken callback injects
//   Authorization: Bearer <token> on every request without needing
//   a Supabase session. auth.uid() works via the JWT sub claim.
//   The separate auth client owns OAuth, guest auth, and identity linking.
//   setSession is used only to restore a guest session before linkIdentity.
// ──────────────────────────────────────

const STORAGE_KEY_ONBOARDED = 'groopay:onboarded';
const STORAGE_KEY_DEMO_GROUP = 'groopay:demo_group';

interface AuthContextValue {
  user: Profile | null;
  isAnonymous: boolean;
  isLoading: boolean;
  isOnboarded: boolean;
  signIn: () => Promise<void>;
  signInWithProvider: (provider: OAuthProvider) => Promise<boolean>;
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

interface CompletedOAuthSignIn {
  userId: string;
  profile: Profile;
  isAnonymous: boolean;
  profileNeedsRetry: boolean;
}

async function completeOAuthSignIn(
  callbackUrl: string,
  expectedUserId?: string,
): Promise<CompletedOAuthSignIn> {
  const hashIndex = callbackUrl.indexOf('#');
  if (hashIndex < 0) {
    throw new Error('No authentication tokens returned');
  }

  const params = new URLSearchParams(callbackUrl.slice(hashIndex + 1));
  const callbackError = params.get('error_description') ?? params.get('error');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (callbackError) {
    throw new Error(callbackError);
  }
  if (!accessToken) {
    throw new Error('No access token returned');
  }

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(accessToken);
  if (userError || !userData.user) {
    throw new Error(userError?.message ?? 'No user returned');
  }

  if (expectedUserId && userData.user.id !== expectedUserId) {
    throw new Error('Identity linking returned a different user');
  }
  if (expectedUserId && userData.user.is_anonymous !== false) {
    throw new Error('Identity linking did not complete');
  }

  setSupabaseAccessToken(accessToken);
  await AsyncStorage.setItem(STORAGE_KEY_ACCESS_TOKEN, accessToken);
  if (refreshToken) {
    await AsyncStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, refreshToken);
  }

  const profile = await fetchProfile(userData.user.id);
  if (profile) {
    return {
      userId: userData.user.id,
      profile: profileRowToProfile(profile),
      isAnonymous: userData.user.is_anonymous ?? false,
      profileNeedsRetry: false,
    };
  }

  return {
    userId: userData.user.id,
    profile: {
      id: userData.user.id,
      display_name:
        userData.user.user_metadata?.full_name ??
        userData.user.user_metadata?.name ??
        'Kullanıcı',
      avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!,
      locale: 'tr',
      preferred_currency: null,
      user_pro: false,
      user_pro_purchased_at: null,
    },
    isAnonymous: userData.user.is_anonymous ?? false,
    profileNeedsRetry: true,
  };
}

async function restoreAuthSessionForIdentityLinking(): Promise<Session | null> {
  const [accessToken, refreshToken] = await AsyncStorage.multiGet([
    STORAGE_KEY_ACCESS_TOKEN,
    STORAGE_KEY_REFRESH_TOKEN,
  ]);
  const storedAccessToken = accessToken[1];
  const storedRefreshToken = refreshToken[1];

  if (!storedAccessToken || !storedRefreshToken) return null;

  const sessionResult = await Promise.race([
    supabaseAuth.auth.setSession({
      access_token: storedAccessToken,
      refresh_token: storedRefreshToken,
    }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ]);

  if (!sessionResult || sessionResult.error) return null;
  return sessionResult.data.session;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
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
          const { data: userData, error: userError } = await supabaseAuth.auth.getUser(storedToken);

          if (userError || !userData?.user) {
            console.log('[auth] Stored token expired, clearing…');
            setSupabaseAccessToken(null);
            await AsyncStorage.multiRemove([STORAGE_KEY_ACCESS_TOKEN, STORAGE_KEY_REFRESH_TOKEN]);
          } else {
            console.log('[auth] Token valid, user:', userData.user.id);
            setIsAnonymous(userData.user.is_anonymous ?? false);
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
    // The dedicated auth client can inspect its in-memory session without
    // affecting the access-token client used for DB queries.
    let authSession: Session | null = null;
    try {
      const { data: { session } } = await supabaseAuth.auth.getSession();
      authSession = session;
    } catch {
      console.log('[auth] Auth session unavailable, proceeding with OAuth');
    }

    if (isAnonymous) {
      if (!authSession?.user?.is_anonymous) {
        authSession = await restoreAuthSessionForIdentityLinking();
      }
      if (!authSession?.user?.is_anonymous) {
        throw new Error('Anonymous session is unavailable for identity linking');
      }

      const anonymousUserId = authSession.user.id;
      const { data: linkData, error: linkError } = await supabaseAuth.auth.linkIdentity({
        provider,
        options: {
          skipBrowserRedirect: true,
          redirectTo: 'groopay://auth/callback',
        },
      });

      if (linkError) {
        console.error('[auth] linkIdentity failed:', linkError.message);
        throw linkError;
      }
      if (!linkData.url) {
        throw new Error('Identity linking URL was not returned');
      }

      const result = await WebBrowser.openAuthSessionAsync(
        linkData.url,
        'groopay://auth/callback',
      );
      if (result.type !== 'success' || !result.url) return false;

      const linkedUser = await completeOAuthSignIn(result.url, anonymousUserId);
      setUser(linkedUser.profile);
      setIsAnonymous(false);
      if (linkedUser.profileNeedsRetry) {
        setTimeout(async () => {
          const retry = await fetchProfile(linkedUser.userId);
          if (retry) setUser(profileRowToProfile(retry));
        }, 1500);
      }
      return true;
    }

    // Standard OAuth sign-in
    const { data, error } = await supabaseAuth.auth.signInWithOAuth({
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
        const completed = await completeOAuthSignIn(result.url);
        setUser(completed.profile);
        setIsAnonymous(completed.isAnonymous);
        if (completed.profileNeedsRetry) {
          setTimeout(async () => {
            const retry = await fetchProfile(completed.userId);
            if (retry) setUser(profileRowToProfile(retry));
          }, 1500);
        }
        return true;
      } else if (result.type === 'cancel') {
        console.log('[auth] OAuth browser cancelled by user');
      }
    }
    return false;
  }, [isAnonymous]);

  // ── GUEST SIGN-IN ──
  const signIn = useCallback(async () => {
    const { data, error } = await supabaseAuth.auth.signInAnonymously();

    if (error) {
      console.error('[auth] Anonymous sign-in failed:', error.message);
      throw error;
    }

    if (data.user && data.session) {
      setIsAnonymous(true);
      setSupabaseAccessToken(data.session.access_token);
      await AsyncStorage.setItem(STORAGE_KEY_ACCESS_TOKEN, data.session.access_token);
      if (data.session.refresh_token) {
        await AsyncStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, data.session.refresh_token);
      }

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
    setUser(null);
    setIsAnonymous(false);
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
      value={{
        user,
        isAnonymous,
        isLoading,
        isOnboarded,
        signIn,
        signInWithProvider,
        signOut,
        updateProfile,
        setOnboarded,
      }}
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
