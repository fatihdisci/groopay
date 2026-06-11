import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, AppState, Platform } from 'react-native';
import {
  isAuthRetryableFetchError,
  type Session,
  type User,
} from '@supabase/supabase-js';
import i18n from '@/lib/i18n';
import {
  supabase,
  supabaseAuth,
  setSupabaseAccessToken,
  STORAGE_KEY_ACCESS_TOKEN,
  STORAGE_KEY_REFRESH_TOKEN,
  STORAGE_KEY_TOKEN_EXPIRES_AT,
} from '@/lib/supabase/client';
import { AVATAR_COLORS } from '@/constants/avatarColors';
import type { ProfileRow } from '@/lib/supabase/types';
import type { Profile, OAuthProvider, GuestUpgradeResult } from './types';

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
const STORAGE_KEY_AUTH_SNAPSHOT = 'groopay:auth-snapshot';
const TOKEN_REFRESH_WINDOW_SECONDS = 15 * 60;
const REFRESH_DEBOUNCE_MS = 5000;
/** Fire proactive refresh 10 min before the typical 1 h token expiry. */
const PROACTIVE_REFRESH_INTERVAL_MS = 50 * 60 * 1000; // 50 minutes

interface AuthContextValue {
  user: Profile | null;
  isAnonymous: boolean;
  isLoading: boolean;
  isOnboarded: boolean;
  signIn: () => Promise<void>;
  signInWithProvider: (provider: OAuthProvider) => Promise<boolean>;
  /** Guest → OAuth upgrade for purchase flow. Detects identity-already-linked
   *  and returns it as a status rather than throwing a technical error. */
  guestUpgradeForPurchase: (provider: OAuthProvider) => Promise<GuestUpgradeResult>;
  /** Sign in with an existing OAuth account (not linkIdentity).
   *  Apple: uses the preserved token from a prior guestUpgradeForPurchase call.
   *  Google: opens a fresh OAuth sign-in (not identity linking).
   *  Returns the signed-in Supabase user id, or null on cancel/failure —
   *  callers must re-login RevenueCat with this id before purchasing. */
  signInWithExistingOAuthAccount: (provider: OAuthProvider, appleToken?: string, appleNonce?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<boolean>;
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

interface StoredAuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

interface StoredAuthSnapshot {
  profile: Profile;
  isAnonymous: boolean;
}

type RefreshResult =
  | { status: 'success'; session: Session }
  | { status: 'network-error' }
  | { status: 'invalid-session' }
  | { status: 'skipped' };

async function getStoredAuthTokens(): Promise<StoredAuthTokens> {
  const entries = await AsyncStorage.multiGet([
    STORAGE_KEY_ACCESS_TOKEN,
    STORAGE_KEY_REFRESH_TOKEN,
    STORAGE_KEY_TOKEN_EXPIRES_AT,
  ]);
  const expiresAtValue = entries[2][1];
  const parsedExpiresAt = expiresAtValue ? Number(expiresAtValue) : Number.NaN;

  return {
    accessToken: entries[0][1],
    refreshToken: entries[1][1],
    expiresAt: Number.isFinite(parsedExpiresAt) ? parsedExpiresAt : null,
  };
}

async function persistAuthTokens(
  accessToken: string,
  refreshToken: string | null,
  expiresAt: number | null,
): Promise<void> {
  setSupabaseAccessToken(accessToken);

  const entries: [string, string][] = [[STORAGE_KEY_ACCESS_TOKEN, accessToken]];
  if (refreshToken) {
    entries.push([STORAGE_KEY_REFRESH_TOKEN, refreshToken]);
  }
  if (expiresAt) {
    entries.push([STORAGE_KEY_TOKEN_EXPIRES_AT, String(expiresAt)]);
  }
  await AsyncStorage.multiSet(entries);

  const keysToRemove: string[] = [];
  if (!refreshToken) keysToRemove.push(STORAGE_KEY_REFRESH_TOKEN);
  if (!expiresAt) keysToRemove.push(STORAGE_KEY_TOKEN_EXPIRES_AT);
  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
  }
}

async function clearStoredAuthTokens(): Promise<void> {
  setSupabaseAccessToken(null);
  await AsyncStorage.multiRemove([
    STORAGE_KEY_ACCESS_TOKEN,
    STORAGE_KEY_REFRESH_TOKEN,
    STORAGE_KEY_TOKEN_EXPIRES_AT,
  ]);
}

function isProfile(value: unknown): value is Profile {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'id' in value
    && typeof value.id === 'string'
    && 'display_name' in value
    && typeof value.display_name === 'string'
    && 'avatar_color' in value
    && typeof value.avatar_color === 'string'
    && 'locale' in value
    && typeof value.locale === 'string'
    && 'preferred_currency' in value
    && (typeof value.preferred_currency === 'string' || value.preferred_currency === null)
    && 'user_pro' in value
    && typeof value.user_pro === 'boolean'
    && 'user_pro_purchased_at' in value
    && (typeof value.user_pro_purchased_at === 'string' || value.user_pro_purchased_at === null)
  );
}

async function persistAuthSnapshot(
  profile: Profile,
  isAnonymous: boolean,
): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEY_AUTH_SNAPSHOT,
    JSON.stringify({ profile, isAnonymous }),
  );
}

async function getStoredAuthSnapshot(): Promise<StoredAuthSnapshot | null> {
  const value = await AsyncStorage.getItem(STORAGE_KEY_AUTH_SNAPSHOT);
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === 'object'
      && parsed !== null
      && 'profile' in parsed
      && isProfile(parsed.profile)
      && 'isAnonymous' in parsed
      && typeof parsed.isAnonymous === 'boolean'
    ) {
      return {
        profile: parsed.profile,
        isAnonymous: parsed.isAnonymous,
      };
    }
  } catch {
    // Ignore malformed legacy cache entries.
  }
  return null;
}

function shouldRefreshToken(expiresAt: number | null): boolean {
  if (!expiresAt) return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return expiresAt <= nowSeconds + TOKEN_REFRESH_WINDOW_SECONDS;
}

function isTransientRefreshError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true;
  if (typeof error !== 'object' || error === null) return false;

  const status = 'status' in error && typeof error.status === 'number'
    ? error.status
    : null;
  return status === 0 || status === 429 || (status !== null && status >= 500);
}

async function completeTokenSignIn(
  authUser: User,
  accessToken: string,
  refreshToken: string | null,
  expectedUserId?: string,
  expiresAt: number | null = null,
): Promise<CompletedOAuthSignIn> {
  if (expectedUserId && authUser.id !== expectedUserId) {
    throw new Error('Identity linking returned a different user');
  }
  if (expectedUserId && authUser.is_anonymous !== false) {
    throw new Error('Identity linking did not complete');
  }

  await persistAuthTokens(accessToken, refreshToken, expiresAt);

  const profile = await fetchProfile(authUser.id);
  if (profile) {
    return {
      userId: authUser.id,
      profile: profileRowToProfile(profile),
      isAnonymous: authUser.is_anonymous ?? false,
      profileNeedsRetry: false,
    };
  }

  return {
    userId: authUser.id,
    profile: {
      id: authUser.id,
      display_name:
        authUser.user_metadata?.full_name ??
        authUser.user_metadata?.name ??
        'Kullanıcı',
      avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!,
      locale: 'tr',
      preferred_currency: null,
      user_pro: false,
      user_pro_purchased_at: null,
    },
    isAnonymous: authUser.is_anonymous ?? false,
    profileNeedsRetry: true,
  };
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
  const expiresInValue = params.get('expires_in');
  const expiresIn = expiresInValue ? Number(expiresInValue) : Number.NaN;

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

  return completeTokenSignIn(
    userData.user,
    accessToken,
    refreshToken,
    expectedUserId,
    Number.isFinite(expiresIn)
      ? Math.floor(Date.now() / 1000) + expiresIn
      : null,
  );
}

async function restoreAuthSessionForIdentityLinking(): Promise<Session | null> {
  const [accessToken, refreshToken] = await AsyncStorage.multiGet([
    STORAGE_KEY_ACCESS_TOKEN,
    STORAGE_KEY_REFRESH_TOKEN,
  ]);
  const storedAccessToken = accessToken[1];
  const storedRefreshToken = refreshToken[1];

  if (!storedAccessToken || !storedRefreshToken) return null;

  const { data, error } = await supabaseAuth.auth.setSession({
    access_token: storedAccessToken,
    refresh_token: storedRefreshToken,
  });

  if (error || !data.session) return null;
  return data.session;
}

function isAppleSignInCancellation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ERR_REQUEST_CANCELED'
  );
}

/** Detect Supabase "identity already linked to another user" errors
 *  so we can offer a friendly "continue with existing account" path
 *  instead of a technical error that blocks the IAP purchase flow. */
function isAlreadyLinkedError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = 'code' in error ? (error as Record<string, unknown>).code : null;
  if (code === 'identity_already_exists') return true;
  const message = 'message' in error ? String((error as Record<string, unknown>).message) : '';
  const lower = message.toLowerCase();
  return lower.includes('already') && (lower.includes('linked') || lower.includes('exists') || lower.includes('registered'));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  // Always-current user for long-running async flows (e.g. the paywall's
  // post-purchase polling) that would otherwise capture a stale closure
  // after a guest → existing-account switch.
  const userRef = useRef<Profile | null>(null);
  const isAnonymousRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<RefreshResult> | null>(null);
  const lastRefreshAttemptRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);
  const proactiveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    userRef.current = user;
    isAnonymousRef.current = isAnonymous;
  }, [user, isAnonymous]);

  const expireSession = useCallback(async (showMessage: boolean): Promise<void> => {
    await clearStoredAuthTokens();
    await AsyncStorage.multiRemove([
      STORAGE_KEY_AUTH_SNAPSHOT,
      STORAGE_KEY_ONBOARDED,
    ]);
    setUser(null);
    setIsAnonymous(false);
    setIsOnboarded(false);
    router.replace('/(auth)/sign-in');

    if (showMessage) {
      Alert.alert(
        i18n.t('auth.sessionExpiredTitle'),
        i18n.t('auth.sessionExpiredMessage'),
      );
    }
  }, []);

  const restoreCachedAuthState = useCallback(async (): Promise<boolean> => {
    const [snapshot, storedOnboarded] = await Promise.all([
      getStoredAuthSnapshot(),
      AsyncStorage.getItem(STORAGE_KEY_ONBOARDED),
    ]);
    if (!snapshot) return false;

    setUser(snapshot.profile);
    setIsAnonymous(snapshot.isAnonymous);
    setIsOnboarded(storedOnboarded === 'true');
    return true;
  }, []);

  const refreshStoredSession = useCallback(async (): Promise<RefreshResult> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const now = Date.now();
    if (now - lastRefreshAttemptRef.current < REFRESH_DEBOUNCE_MS) {
      return { status: 'skipped' };
    }
    lastRefreshAttemptRef.current = now;

    const refreshPromise = (async (): Promise<RefreshResult> => {
      const { refreshToken } = await getStoredAuthTokens();
      if (!refreshToken) {
        return { status: 'invalid-session' };
      }

      try {
        const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refreshToken });

        if (error) {
          if (isTransientRefreshError(error)) {
            console.warn('[auth] Token refresh deferred due to network:', error.message);
            return { status: 'network-error' };
          }
          console.warn('[auth] Refresh token is invalid:', error.message);
          return { status: 'invalid-session' };
        }
        if (!data.session) {
          return { status: 'invalid-session' };
        }

        const session = data.session;
        await persistAuthTokens(
          session.access_token,
          session.refresh_token,
          session.expires_at ?? null,
        );
        console.log('[auth] Access token refreshed');
        return { status: 'success', session };
      } catch (error: unknown) {
        if (isTransientRefreshError(error)) {
          console.warn('[auth] Token refresh deferred due to network');
          return { status: 'network-error' };
        }
        console.warn('[auth] Token refresh failed:', error);
        return { status: 'network-error' };
      }
    })();

    refreshPromiseRef.current = refreshPromise;
    try {
      return await refreshPromise;
    } finally {
      refreshPromiseRef.current = null;
    }
  }, []);

  // ── Proactive foreground token refresh (every 50 min) ──
  const proactiveTokenRefresh = useCallback(async (): Promise<void> => {
    try {
      const storedTokens = await getStoredAuthTokens();
      if (!storedTokens.accessToken) return;

      // Validate current token first to avoid unnecessary refresh-token rotations.
      const { data: userData, error: userError } = await supabaseAuth.auth.getUser(
        storedTokens.accessToken,
      );

      if (!userError && userData?.user) {
        // Token still valid — nothing to do.
        return;
      }

      // Token is expired or invalid; attempt a refresh.
      console.log('[AuthContext] Proactive token refresh');
      const refreshResult = await refreshStoredSession();
      if (refreshResult.status === 'invalid-session') {
        await expireSession(true);
      }
    } catch (error: unknown) {
      console.warn('[auth] Proactive token check failed:', error);
    }
  }, [expireSession, refreshStoredSession]);

  // ── Restore session on mount (cold start) ──
  useEffect(() => {
    (async () => {
      try {
        console.log('[auth] Cold start: restoring token from storage…');
        const storedTokens = await getStoredAuthTokens();
        let storedToken = storedTokens.accessToken;

        if (storedToken) {
          setSupabaseAccessToken(storedToken);

          if (shouldRefreshToken(storedTokens.expiresAt)) {
            const refreshResult = await refreshStoredSession();
            if (refreshResult.status === 'success') {
              storedToken = refreshResult.session.access_token;
            } else if (refreshResult.status === 'invalid-session') {
              await expireSession(true);
              return;
            } else if (refreshResult.status === 'network-error') {
              await restoreCachedAuthState();
              return;
            } else {
              storedToken = (await getStoredAuthTokens()).accessToken;
              if (!storedToken) return;
            }
          }

          const { data: userData, error: userError } = await supabaseAuth.auth.getUser(storedToken);

          if (userError || !userData?.user) {
            if (isTransientRefreshError(userError)) {
              console.warn('[auth] User verification deferred due to network');
              await restoreCachedAuthState();
              return;
            }
            await expireSession(true);
          } else {
            console.log('[auth] Token valid, user:', userData.user.id);
            setIsAnonymous(userData.user.is_anonymous ?? false);
            const profile = await fetchProfile(userData.user.id);
            if (profile) {
              const mappedProfile = profileRowToProfile(profile);
              setUser(mappedProfile);
              await persistAuthSnapshot(
                mappedProfile,
                userData.user.is_anonymous ?? false,
              );
            } else {
              await restoreCachedAuthState();
              return;
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
  }, [expireSession, refreshStoredSession, restoreCachedAuthState]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasInBackground = appStateRef.current === 'background'
        || appStateRef.current === 'inactive';
      appStateRef.current = nextState;

      if (!wasInBackground || nextState !== 'active') return;

      void (async () => {
        try {
          const storedTokens = await getStoredAuthTokens();
          if (!storedTokens.accessToken || !shouldRefreshToken(storedTokens.expiresAt)) {
            return;
          }

          const refreshResult = await refreshStoredSession();
          if (refreshResult.status === 'invalid-session') {
            await expireSession(true);
          }
        } catch (error: unknown) {
          console.warn('[auth] Foreground token check failed:', error);
        }
      })();
    });

    return () => subscription.remove();
  }, [expireSession, refreshStoredSession]);

  // ── Proactive foreground refresh interval ──
  // Runs every 50 min while the user is signed in, so a token that expires
  // after 1 h never goes stale while the app stays in the foreground.
  useEffect(() => {
    if (!user) {
      if (proactiveIntervalRef.current) {
        clearInterval(proactiveIntervalRef.current);
        proactiveIntervalRef.current = null;
      }
      return;
    }

    proactiveIntervalRef.current = setInterval(() => {
      void proactiveTokenRefresh();
    }, PROACTIVE_REFRESH_INTERVAL_MS);

    return () => {
      if (proactiveIntervalRef.current) {
        clearInterval(proactiveIntervalRef.current);
        proactiveIntervalRef.current = null;
      }
    };
  }, [user, proactiveTokenRefresh]);

  const applyCompletedSignIn = useCallback((completed: CompletedOAuthSignIn) => {
    // Update refs synchronously: purchase flows continue in the same async
    // chain and must see the new user before React re-renders.
    userRef.current = completed.profile;
    isAnonymousRef.current = completed.isAnonymous;
    setUser(completed.profile);
    setIsAnonymous(completed.isAnonymous);
    void persistAuthSnapshot(completed.profile, completed.isAnonymous);
    if (completed.profileNeedsRetry) {
      setTimeout(async () => {
        const retry = await fetchProfile(completed.userId);
        if (retry) {
          const mappedProfile = profileRowToProfile(retry);
          setUser(mappedProfile);
          await persistAuthSnapshot(mappedProfile, completed.isAnonymous);
        }
      }, 1500);
    }
  }, []);

  // ── GOOGLE / APPLE AUTH ──
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

    if (provider === 'apple' && Platform.OS === 'ios') {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        throw new Error(i18n.t('auth.appleUnavailable'));
      }

      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      try {
        const credential = await AppleAuthentication.signInAsync({
          nonce: hashedNonce,
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        if (!credential.identityToken) {
          throw new Error(i18n.t('auth.appleTokenMissing'));
        }

        if (isAnonymous) {
          if (!authSession?.user?.is_anonymous) {
            authSession = await restoreAuthSessionForIdentityLinking();
          }
          if (!authSession?.user?.is_anonymous) {
            throw new Error('Anonymous session is unavailable for identity linking');
          }

          const anonymousUserId = authSession.user.id;
          const { data, error } = await supabaseAuth.auth.linkIdentity({
            provider: 'apple',
            token: credential.identityToken,
            nonce: rawNonce,
          });

          if (error) {
            console.error('[auth] Native Apple identity linking failed:', error.message);
            throw error;
          }
          if (!data.user || !data.session) {
            throw new Error(i18n.t('auth.appleSessionMissing'));
          }
          if (data.user.id !== anonymousUserId || data.user.is_anonymous !== false) {
            await restoreAuthSessionForIdentityLinking();
            throw new Error(i18n.t('auth.appleUpgradeMismatch'));
          }

          const completed = await completeTokenSignIn(
            data.user,
            data.session.access_token,
            data.session.refresh_token,
            anonymousUserId,
            data.session.expires_at ?? null,
          );
          applyCompletedSignIn(completed);
          return true;
        }

        const { data, error } = await supabaseAuth.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
          nonce: rawNonce,
        });

        if (error) {
          console.error('[auth] Native Apple sign-in failed:', error.message);
          throw error;
        }
        if (!data.user || !data.session) {
          throw new Error(i18n.t('auth.appleSessionMissing'));
        }

        const completed = await completeTokenSignIn(
          data.user,
          data.session.access_token,
          data.session.refresh_token,
          undefined,
          data.session.expires_at ?? null,
        );
        applyCompletedSignIn(completed);
        return true;
      } catch (error: unknown) {
        if (isAppleSignInCancellation(error)) {
          console.log('[auth] Native Apple sign-in cancelled by user');
          return false;
        }
        throw error;
      }
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
      applyCompletedSignIn(linkedUser);
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
        applyCompletedSignIn(completed);
        return true;
      } else if (result.type === 'cancel') {
        console.log('[auth] OAuth browser cancelled by user');
      }
    }
    return false;
  }, [applyCompletedSignIn, isAnonymous]);

  // ── GUEST → PRO PURCHASE UPGRADE ──
  // Unlike signInWithProvider, this function detects identity-already-linked
  // errors and returns them as a structured result instead of throwing.
  // This prevents a technical error Alert from blocking the IAP purchase sheet.

  const signInWithExistingOAuthAccount = useCallback(async (
    provider: OAuthProvider,
    appleToken?: string,
    appleNonce?: string,
  ): Promise<string | null> => {
    if (provider === 'apple' && appleToken && appleNonce && Platform.OS === 'ios') {
      const { data, error } = await supabaseAuth.auth.signInWithIdToken({
        provider: 'apple',
        token: appleToken,
        nonce: appleNonce,
      });
      if (error) throw error;
      if (!data.user || !data.session) throw new Error(i18n.t('auth.appleSessionMissing'));

      const completed = await completeTokenSignIn(
        data.user,
        data.session.access_token,
        data.session.refresh_token,
        undefined,
        data.session.expires_at ?? null,
      );
      applyCompletedSignIn(completed);
      return completed.userId;
    }

    // Google / web OAuth: fresh sign-in (not linkIdentity)
    const { data, error } = await supabaseAuth.auth.signInWithOAuth({
      provider,
      options: {
        skipBrowserRedirect: true,
        redirectTo: 'groopay://auth/callback',
      },
    });

    if (error) throw error;
    if (!data?.url) return null;

    const result = await WebBrowser.openAuthSessionAsync(data.url, 'groopay://auth/callback');
    if (result.type === 'success' && result.url) {
      const completed = await completeOAuthSignIn(result.url);
      applyCompletedSignIn(completed);
      return completed.userId;
    }
    return null;
  }, [applyCompletedSignIn]);

  const guestUpgradeForPurchase = useCallback(async (
    provider: OAuthProvider,
  ): Promise<GuestUpgradeResult> => {
    // ── Restore anonymous session for identity linking ──
    let authSession: Session | null = null;
    try {
      const { data: { session } } = await supabaseAuth.auth.getSession();
      authSession = session;
    } catch { /* ignore */ }

    // ── iOS Native Apple ──
    if (provider === 'apple' && Platform.OS === 'ios') {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return { status: 'error', provider, errorMessage: i18n.t('auth.appleUnavailable') };
      }

      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      try {
        const credential = await AppleAuthentication.signInAsync({
          nonce: hashedNonce,
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        if (!credential.identityToken) {
          return { status: 'error', provider, errorMessage: i18n.t('auth.appleTokenMissing') };
        }

        if (!authSession?.user?.is_anonymous) {
          authSession = await restoreAuthSessionForIdentityLinking();
        }
        if (!authSession?.user?.is_anonymous) {
          return { status: 'error', provider, errorMessage: i18n.t('auth.appleSessionMissing') };
        }

        const anonymousUserId = authSession.user.id;
        const { data, error } = await supabaseAuth.auth.linkIdentity({
          provider: 'apple',
          token: credential.identityToken,
          nonce: rawNonce,
        });

        if (error) {
          if (isAlreadyLinkedError(error)) {
            if (__DEV__) {
              console.log('[auth] guestUpgradeForPurchase apple: identity already linked — returning credential for retry');
              console.log('[auth]   old anonymous user_id:', anonymousUserId);
            }
            // Preserve credential so the paywall can call signInWithIdToken later
            return {
              status: 'already_exists',
              provider,
              appleRetryToken: credential.identityToken,
              appleRetryNonce: rawNonce,
            };
          }
          console.error('[auth] Native Apple identity linking failed:', error.message);
          return { status: 'error', provider, errorMessage: error.message };
        }

        if (!data.user || !data.session) {
          return { status: 'error', provider, errorMessage: i18n.t('auth.appleSessionMissing') };
        }
        if (data.user.id !== anonymousUserId || data.user.is_anonymous !== false) {
          await restoreAuthSessionForIdentityLinking();
          return { status: 'error', provider, errorMessage: i18n.t('auth.appleUpgradeMismatch') };
        }

        const completed = await completeTokenSignIn(
          data.user,
          data.session.access_token,
          data.session.refresh_token,
          anonymousUserId,
          data.session.expires_at ?? null,
        );
        applyCompletedSignIn(completed);
        if (__DEV__) {
          console.log('[auth] guestUpgradeForPurchase apple: linked, user_id:', completed.userId);
        }
        return { status: 'linked', provider, userId: completed.userId };
      } catch (error: unknown) {
        if (isAppleSignInCancellation(error)) {
          console.log('[auth] Native Apple sign-in cancelled by user');
          return { status: 'cancelled', provider };
        }
        throw error;
      }
    }

    // ── Google / web OAuth guest upgrade ──
    if (!authSession?.user?.is_anonymous) {
      authSession = await restoreAuthSessionForIdentityLinking();
    }
    if (!authSession?.user?.is_anonymous) {
      return { status: 'error', provider, errorMessage: 'Anonymous session unavailable' };
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
      if (isAlreadyLinkedError(linkError)) {
        if (__DEV__) {
          console.log('[auth] guestUpgradeForPurchase google: linkIdentity returned already-linked');
          console.log('[auth]   old anonymous user_id:', anonymousUserId);
        }
        return { status: 'already_exists', provider };
      }
      console.error('[auth] linkIdentity failed:', linkError.message);
      return { status: 'error', provider, errorMessage: linkError.message };
    }

    if (!linkData.url) {
      return { status: 'error', provider, errorMessage: 'Identity linking URL was not returned' };
    }

    const result = await WebBrowser.openAuthSessionAsync(
      linkData.url,
      'groopay://auth/callback',
    );
    if (result.type !== 'success' || !result.url) {
      return { status: 'cancelled', provider };
    }

    // Check the callback URL for identity-already-linked errors
    try {
      const hashIndex = result.url.indexOf('#');
      if (hashIndex >= 0) {
        const params = new URLSearchParams(result.url.slice(hashIndex + 1));
        const cbError = params.get('error_description') ?? params.get('error');
        if (cbError && isAlreadyLinkedError({ message: cbError })) {
          if (__DEV__) {
            console.log('[auth] guestUpgradeForPurchase google: callback indicates identity already linked');
            console.log('[auth]   old anonymous user_id:', anonymousUserId);
          }
          return { status: 'already_exists', provider };
        }
      }

      const linkedUser = await completeOAuthSignIn(result.url, anonymousUserId);
      applyCompletedSignIn(linkedUser);
      if (__DEV__) {
        console.log('[auth] guestUpgradeForPurchase google: linked, user_id:', linkedUser.userId);
      }
      return { status: 'linked', provider, userId: linkedUser.userId };
    } catch (error: unknown) {
      if (isAlreadyLinkedError(error)) {
        if (__DEV__) {
          console.log('[auth] guestUpgradeForPurchase google: completeOAuthSignIn threw already-linked');
          console.log('[auth]   old anonymous user_id:', anonymousUserId);
        }
        return { status: 'already_exists', provider };
      }
      throw error;
    }
  }, [applyCompletedSignIn]);

  // ── GUEST SIGN-IN ──
  const signIn = useCallback(async () => {
    const { data, error } = await supabaseAuth.auth.signInAnonymously();

    if (error) {
      console.error('[auth] Anonymous sign-in failed:', error.message);
      throw error;
    }

    if (data.user && data.session) {
      setIsAnonymous(true);
      await persistAuthTokens(
        data.session.access_token,
        data.session.refresh_token,
        data.session.expires_at ?? null,
      );

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

      const mappedProfile = profileRowToProfile(profile);
      setUser(mappedProfile);
      await persistAuthSnapshot(mappedProfile, true);

      const hasGroups = await syncOnboardingFlag(data.user.id);
      if (!hasGroups) setIsOnboarded(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearStoredAuthTokens();
    await AsyncStorage.multiRemove([
      STORAGE_KEY_AUTH_SNAPSHOT,
      STORAGE_KEY_ONBOARDED,
    ]);
    setUser(null);
    setIsAnonymous(false);
    setIsOnboarded(false);
  }, []);

  const refreshProfile = useCallback(async (): Promise<boolean> => {
    // Read via refs so long-running callers (paywall activation polling)
    // always refresh the CURRENT user, even after an account switch.
    const currentUser = userRef.current;
    if (!currentUser) return false;

    const profile = await fetchProfile(currentUser.id);
    if (!profile) return false;

    const mappedProfile = profileRowToProfile(profile);
    userRef.current = mappedProfile;
    setUser(mappedProfile);
    await persistAuthSnapshot(mappedProfile, isAnonymousRef.current);
    return mappedProfile.user_pro;
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
      await persistAuthSnapshot(updated, isAnonymous);
    },
    [isAnonymous, user],
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
        guestUpgradeForPurchase,
        signInWithExistingOAuthAccount,
        signOut,
        refreshProfile,
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
