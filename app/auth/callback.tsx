import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase, SUPABASE_STORAGE_KEY } from '@/lib/supabase/client';
import { palette } from '@/constants/theme';

/**
 * Handles deep link: groopay://auth/callback?code=...
 *
 * Cold-start path: the app was killed while the OAuth browser was open.
 * maybeCompleteAuthSession() processes the pending auth, and Expo Router
 * navigates here. We extract the code and exchange it for a Supabase session.
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
          const expires_in = params.get('expires_in');
          const token_type = params.get('token_type');

          console.log('[auth:callback] Token preview — access:', access_token?.substring(0, 20) + '…');
          console.log('[auth:callback] Token preview — refresh:', refresh_token?.substring(0, 20) + '…');
          console.log('[auth:callback] expires_in:', expires_in, 'token_type:', token_type);

          if (access_token) {
            try {
              // ── Step 1: verify token ──
              console.log('[auth:callback] Step 1: getUser…');
              const { data: userData, error: userError } = await supabase.auth.getUser(access_token);
              if (userError) {
                console.error('[auth:callback] getUser failed:', userError.message);
                setError(userError.message);
                return;
              }
              console.log('[auth:callback] getUser OK, user:', userData?.user?.id);

              // ── Step 2: try setSession with timeout ──
              console.log('[auth:callback] Step 2: setSession (4s timeout)…');
              const setSessionPromise = supabase.auth.setSession({
                access_token,
                refresh_token: refresh_token ?? '',
              });
              const timeoutPromise = new Promise<{ _timedOut: true }>((resolve) =>
                setTimeout(() => resolve({ _timedOut: true }), 4000),
              );
              const sessionResult = await Promise.race([setSessionPromise, timeoutPromise]);

              if ('_timedOut' in sessionResult) {
                // ── Fallback: manual storage ──
                console.warn('[auth:callback] setSession timed out — manual storage fallback');
                const expiresAt = expires_in
                  ? Math.floor(Date.now() / 1000) + parseInt(expires_in, 10)
                  : undefined;

                const sessionPayload = JSON.stringify({
                  access_token,
                  refresh_token: refresh_token ?? '',
                  expires_at: expiresAt,
                  token_type: token_type ?? 'bearer',
                  user: userData.user,
                });

                await AsyncStorage.setItem(SUPABASE_STORAGE_KEY, sessionPayload);
                console.log('[auth:callback] Manual storage written');

                const { data: restored } = await supabase.auth.getSession();
                console.log('[auth:callback] Session restored:', restored?.session ? 'YES' : 'NO');
              } else {
                const { data: sessionData, error: setSessionError } = sessionResult;
                console.log('[auth:callback] setSession:', sessionData?.session ? 'OK' : 'NO SESSION');
                if (setSessionError) {
                  console.error('[auth:callback] setSession error:', setSessionError.message);
                  setError(setSessionError.message);
                  return;
                }
                console.log('[auth:callback] Session persisted, user:', sessionData?.session?.user?.id);
              }
            } catch (e: any) {
              console.error('[auth:callback] Exception:', e?.message ?? e);
              setError(e?.message ?? 'Unknown error');
              return;
            }
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
            console.log('[auth:callback] PKCE session established');
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
