import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth';
import type { OAuthProvider } from '@/lib/auth';
import { palette, spacing, fontSizes, radii, minTouchTarget } from '@/constants/theme';

export default function SignInScreen() {
  const { t } = useTranslation();
  const { signIn, signInWithProvider } = useAuth();
  const router = useRouter();
  const [inProgress, setInProgress] = useState<OAuthProvider | 'anon' | null>(null);

  const handleOAuth = async (provider: OAuthProvider) => {
    if (inProgress) return;
    setInProgress(provider);
    try {
      await signInWithProvider(provider);
      // On native, the browser opens and the OAuth redirect comes back
      // via deep link → onAuthStateChange → app/index.tsx handles routing.
      // If signInWithProvider returns immediately (web), navigate manually.
    } catch (e: any) {
      Alert.alert(t('auth.error'), e?.message ?? t('auth.unknownError'));
    } finally {
      setInProgress(null);
    }
  };

  const handleDevSignIn = async () => {
    if (inProgress) return;
    setInProgress('anon');
    try {
      await signIn();
      router.replace('/(onboarding)/intro');
    } catch (e: any) {
      Alert.alert(t('auth.error'), e?.message ?? t('auth.unknownError'));
    } finally {
      setInProgress(null);
    }
  };

  const isBusy = inProgress !== null;

  return (
    <View style={styles.container}>
      {/* Logo & Title */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Ionicons name="wallet-outline" size={48} color={palette.primary} />
        </View>
        <Text style={styles.appName}>{t('auth.appName')}</Text>
        <Text style={styles.tagline}>{t('auth.tagline')}</Text>
      </View>

      {/* OAuth Buttons */}
      <View style={styles.buttonGroup}>
        {/* Google Sign In */}
        <TouchableOpacity
          style={[styles.oauthButton, isBusy && styles.buttonDisabled]}
          onPress={() => handleOAuth('google')}
          activeOpacity={0.7}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel={t('auth.googleSignIn')}
        >
          {inProgress === 'google' ? (
            <ActivityIndicator size="small" color={palette.text} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="#4285F4" />
              <Text style={styles.oauthButtonText}>{t('auth.googleSignIn')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Apple Sign In */}
        <TouchableOpacity
          style={[styles.oauthButton, styles.appleButton, isBusy && styles.buttonDisabled]}
          onPress={() => handleOAuth('apple')}
          activeOpacity={0.7}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel={t('auth.appleSignIn')}
        >
          {inProgress === 'apple' ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
              <Text style={[styles.oauthButtonText, styles.appleButtonText]}>{t('auth.appleSignIn')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Expo Go notice */}
        {Platform.OS !== 'web' && (
          <Text style={styles.oauthNotice}>{t('auth.oauthNotice')}</Text>
        )}

        {/* Divider (only in dev mode) */}
        {__DEV__ && (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth.devSection')}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Dev sign-in (Expo Go / anonymous fallback) */}
            <TouchableOpacity
              style={[styles.devButton, isBusy && styles.buttonDisabled]}
              onPress={handleDevSignIn}
              activeOpacity={0.7}
              disabled={isBusy}
            >
              {inProgress === 'anon' ? (
                <ActivityIndicator size="small" color={palette.primary} />
              ) : (
                <>
                  <Ionicons name="flask-outline" size={18} color={palette.primary} />
                  <Text style={styles.devButtonText}>{t('auth.devSignIn')}</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.devNotice}>{t('auth.devNotice')}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: radii.full,
    backgroundColor: palette.surface,
    borderWidth: 2,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  appName: {
    fontSize: fontSizes.xxxl,
    fontWeight: '700',
    color: palette.text,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: fontSizes.md,
    color: palette.textSecondary,
  },
  buttonGroup: {
    width: '100%',
    maxWidth: 320,
    gap: spacing.sm,
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.sm,
    minHeight: minTouchTarget,
  },
  appleButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  oauthButtonText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: palette.text,
    flex: 1,
  },
  appleButtonText: {
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  oauthNotice: {
    textAlign: 'center',
    fontSize: fontSizes.xs,
    color: palette.muted,
    marginBottom: spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
  },
  dividerText: {
    fontSize: fontSizes.xs,
    color: palette.muted,
  },
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.primary,
    borderStyle: 'dashed',
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    gap: spacing.sm,
    minHeight: minTouchTarget,
  },
  devButtonText: {
    color: palette.primary,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  devNotice: {
    textAlign: 'center',
    fontSize: fontSizes.xs,
    color: palette.muted,
  },
});
