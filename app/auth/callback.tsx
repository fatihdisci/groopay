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
        // Extract code from groopay://auth/callback?code=...
        const codeMatch = url.match(/[?&]code=([^&#]+)/);
        const code = codeMatch ? decodeURIComponent(codeMatch[1]) : null;

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('[auth:callback] Code exchange failed:', exchangeError.message);
            setError(exchangeError.message);
            return;
          }
          // Session established — index.tsx will redirect based on user state
        } else {
          // No code in URL — redirect to sign-in
          console.warn('[auth:callback] No code in callback URL');
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
