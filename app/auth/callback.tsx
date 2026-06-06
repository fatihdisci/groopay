import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  supabase,
  setSupabaseAccessToken,
  STORAGE_KEY_ACCESS_TOKEN,
  STORAGE_KEY_REFRESH_TOKEN,
} from '@/lib/supabase/client';
import { palette } from '@/constants/theme';

/**
 * Handles deep link: groopay://auth/callback#access_token=...&refresh_token=...
 *
 * Cold-start path: the app was killed while the OAuth browser was open.
 * maybeCompleteAuthSession() processes the pending auth, and Expo Router
 * navigates here. We extract tokens, set them via the accessToken callback,
 * persist to AsyncStorage, and navigate to root.
 *
 * Warm-start path: openAuthSessionAsync returns the URL directly in
 * AuthContext.signInWithProvider — this route is not invoked.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const url = Linking.useURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    (async () => {
      try {
        const urlPreview = url.length > 200 ? url.slice(0, 200) + '…' : url;
        console.log('[auth:callback] URL:', urlPreview);

        // ── Implicit flow (primary on native) ──
        const hashIndex = url.indexOf('#');
        if (hashIndex >= 0) {
          const fragment = url.slice(hashIndex + 1);
          console.log('[auth:callback] All fragment params:', fragment);

          const params = new URLSearchParams(fragment);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          console.log('[auth:callback] Token preview — access:', access_token?.substring(0, 20) + '…');

          if (access_token) {
            // ── Step 1: verify token ──
            console.log('[auth:callback] Step 1: getUser…');
            const { data: userData, error: userError } = await supabase.auth.getUser(access_token);
            if (userError || !userData?.user) {
              const msg = userError?.message ?? 'No user returned';
              console.error('[auth:callback] getUser failed:', msg);
              setError(msg);
              return;
            }
            console.log('[auth:callback] getUser OK, user:', userData.user.id);

            // ── Step 2: set token via callback ──
            // auth.uid() now resolves from JWT sub claim → RLS works
            console.log('[auth:callback] Step 2: setSupabaseAccessToken');
            setSupabaseAccessToken(access_token);

            // ── Step 3: persist for next cold start ──
            await AsyncStorage.setItem(STORAGE_KEY_ACCESS_TOKEN, access_token);
            if (refresh_token) {
              await AsyncStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, refresh_token);
            }
            console.log('[auth:callback] Tokens persisted, navigating to root…');

            // Navigate to root — AuthContext useEffect will read the stored
            // token, call getUser to verify, and set the user profile.
            router.replace('/');
          } else {
            console.warn('[auth:callback] No access_token in fragment');
            router.replace('/(auth)/sign-in');
          }
        } else {
          // No fragment — try PKCE code in query string
          const codeMatch = url.match(/[?&]code=([^&#]+)/);
          const code = codeMatch ? decodeURIComponent(codeMatch[1]) : null;

          if (code) {
            console.log('[auth:callback] PKCE fallback: exchanging code (5s timeout)…');
            const exchangePromise = supabase.auth.exchangeCodeForSession(code);
            const timeoutPromise = new Promise<{ _timedOut: true }>((resolve) =>
              setTimeout(() => resolve({ _timedOut: true }), 5000),
            );
            const exchangeResult = await Promise.race([exchangePromise, timeoutPromise]);

            if ('_timedOut' in exchangeResult) {
              console.error('[auth:callback] PKCE exchange timed out');
              setError('Oturum açma zaman aşımına uğradı. Lütfen tekrar deneyin.');
              return;
            }

            const { error: exchangeError } = exchangeResult;
            if (exchangeError) {
              console.error('[auth:callback] PKCE exchange failed:', exchangeError.message);
              setError(exchangeError.message);
              return;
            }
            console.log('[auth:callback] PKCE session established — navigating to root');
            router.replace('/');
          } else {
            console.warn('[auth:callback] No fragment or code in callback URL');
            router.replace('/(auth)/sign-in');
          }
        }
      } catch (e: any) {
        console.error('[auth:callback] Unexpected error:', e?.message);
        setError(e?.message ?? 'Unknown error');
      }
    })();
  }, [url, router]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Oturum açılamadı</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={palette.primary} />
      <Text style={styles.loadingText}>Oturum açılıyor...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: palette.textSecondary,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.danger,
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 13,
    color: palette.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
