import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import { supabase } from '@/lib/supabase/client';
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
              // ── Diagnostic: verify token before trying to store session ──
              console.log('[auth:callback] Diagnostic: getUser with access_token…');
              const userPromise = supabase.auth.getUser(access_token);
              const userTimeoutPromise = new Promise<{ _userTimedOut: true }>((resolve) =>
                setTimeout(() => resolve({ _userTimedOut: true }), 6000),
              );
              const userResult = await Promise.race([userPromise, userTimeoutPromise]);

              if ('_userTimedOut' in userResult) {
                console.error('[auth:callback] getUser timed out — API unreachable or bad token');
                setError('Sunucuya ulaşılamıyor. Lütfen internet bağlantınızı kontrol edin.');
                return;
              }

              const { data: userData, error: userError } = userResult;
              if (userError) {
                console.error('[auth:callback] getUser failed:', userError.message);
                setError(userError.message);
                return;
              }
              console.log('[auth:callback] getUser OK — token valid, user:', userData?.user?.id);

              // Token is valid — persist the session
              console.log('[auth:callback] Persisting session via setSession…');
              const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
                access_token,
                refresh_token: refresh_token ?? '',
              });

              console.log('[auth:callback] setSession:', sessionData?.session ? 'OK' : 'NO SESSION');
              if (setSessionError) {
                console.error('[auth:callback] setSession error:', setSessionError.message);
                setError(setSessionError.message);
                return;
              }
              console.log('[auth:callback] Session persisted, user:', sessionData?.session?.user?.id);
              // index.tsx will redirect based on user state (via onAuthStateChange)
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
