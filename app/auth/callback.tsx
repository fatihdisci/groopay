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
        console.log('[auth:callback] Has query (?):', url.includes('?'));
        console.log('[auth:callback] Has fragment (#):', url.includes('#'));

        // ── Implicit flow (primary on native, no WebCrypto needed) ──
        const fragmentMatch = url.match(/#(.*)$/);
        const fragment = fragmentMatch ? fragmentMatch[1] : '';
        const accessTokenMatch = fragment.match(/access_token=([^&]+)/);
        const refreshTokenMatch = fragment.match(/refresh_token=([^&]+)/);

        // ── PKCE fallback ──
        const codeMatch = url.match(/[?&]code=([^&#]+)/);
        const code = codeMatch ? decodeURIComponent(codeMatch[1]) : null;

        if (accessTokenMatch && refreshTokenMatch) {
          console.log('[auth:callback] Implicit flow: setting session from fragment tokens…');
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: decodeURIComponent(accessTokenMatch[1]),
            refresh_token: decodeURIComponent(refreshTokenMatch[1]),
          });
          if (setSessionError) {
            console.error('[auth:callback] setSession failed:', setSessionError.message);
            setError(setSessionError.message);
            return;
          }
          console.log('[auth:callback] Implicit session established');
        } else if (code) {
          console.log('[auth:callback] PKCE fallback: exchanging code (5s timeout)…');
          const exchangePromise = supabase.auth.exchangeCodeForSession(code);
          const timeoutPromise = new Promise<{ timedOut: true }>((resolve) =>
            setTimeout(() => resolve({ timedOut: true }), 5000),
          );
          const exchangeResult = await Promise.race([exchangePromise, timeoutPromise]);

          if ('timedOut' in exchangeResult) {
            console.error('[auth:callback] PKCE exchangeCodeForSession timed out');
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
          console.warn('[auth:callback] No code or tokens in callback URL');
          router.replace('/(auth)/sign-in');
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
