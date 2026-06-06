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
        console.log('[auth:callback] URL received');
        console.log('[auth:callback] URL length:', url.length);
        console.log('[auth:callback] Has query (?):', url.includes('?'));
        console.log('[auth:callback] Has fragment (#):', url.includes('#'));

        // PKCE flow: code is in the query string → groopay://auth/callback?code=xxx
        const codeMatch = url.match(/[?&]code=([^&#]+)/);
        const code = codeMatch ? decodeURIComponent(codeMatch[1]) : null;

        // Implicit flow fallback: tokens are in the fragment
        const fragmentMatch = url.match(/#(.*)$/);
        const fragment = fragmentMatch ? fragmentMatch[1] : '';
        const accessTokenMatch = fragment.match(/access_token=([^&]+)/);
        const refreshTokenMatch = fragment.match(/refresh_token=([^&]+)/);

        if (code) {
          console.log('[auth:callback] PKCE code found, exchanging for session...');
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('[auth:callback] Code exchange failed:', exchangeError.message);
            setError(exchangeError.message);
            return;
          }
          console.log('[auth:callback] PKCE code exchange successful');
          // Session established — index.tsx will redirect based on user state
        } else if (accessTokenMatch && refreshTokenMatch) {
          console.log('[auth:callback] Implicit flow tokens found, setting session...');
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: decodeURIComponent(accessTokenMatch[1]),
            refresh_token: decodeURIComponent(refreshTokenMatch[1]),
          });
          if (setSessionError) {
            console.error('[auth:callback] setSession failed:', setSessionError.message);
            setError(setSessionError.message);
            return;
          }
          console.log('[auth:callback] Implicit session set successful');
        } else {
          // No recognizable auth params — redirect to sign-in
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
