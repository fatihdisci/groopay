import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { palette, spacing, fontSizes, radii, minTouchTarget } from '@/constants/theme';

export default function SignInScreen() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleDevSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await signIn();
      // New anon sign-in always goes to onboarding.
      // Session restore (app reopen) is handled by app/index.tsx.
      router.replace('/(onboarding)/intro');
    } catch (e: any) {
      Alert.alert('Hata', e?.message ?? 'Giriş yapılamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleOAuthPlaceholder = () => {
    Alert.alert('Groopay', t('auth.comingSoon'));
  };

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

      {/* Buttons */}
      <View style={styles.buttonGroup}>
        {/* Dev sign-in */}
        <TouchableOpacity
          style={[styles.devButton, isSigningIn && styles.buttonDisabled]}
          onPress={handleDevSignIn}
          activeOpacity={0.7}
          disabled={isSigningIn}
        >
          {isSigningIn ? (
            <ActivityIndicator size="small" color={palette.background} />
          ) : (
            <>
              <Ionicons name="flask-outline" size={20} color={palette.background} />
              <Text style={styles.devButtonText}>{t('auth.devSignIn')}</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.devNotice}>{t('auth.devNotice')}</Text>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
        </View>

        {/* OAuth placeholders (TODO: Phase 1B) */}
        <TouchableOpacity
          style={[styles.oauthButton, styles.oauthButtonDisabled]}
          onPress={handleOAuthPlaceholder}
          activeOpacity={0.7}
        >
          <Ionicons name="logo-google" size={20} color={palette.muted} />
          <Text style={styles.oauthButtonText}>{t('auth.googleSignIn')}</Text>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>{t('auth.comingSoon')}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.oauthButton, styles.oauthButtonDisabled]}
          onPress={handleOAuthPlaceholder}
          activeOpacity={0.7}
        >
          <Ionicons name="logo-apple" size={20} color={palette.muted} />
          <Text style={styles.oauthButtonText}>{t('auth.appleSignIn')}</Text>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>{t('auth.comingSoon')}</Text>
          </View>
        </TouchableOpacity>
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
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.sm,
    minHeight: minTouchTarget,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  devButtonText: {
    color: palette.background,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  devNotice: {
    textAlign: 'center',
    fontSize: fontSizes.xs,
    color: palette.muted,
    marginBottom: spacing.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
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
  oauthButtonDisabled: {
    opacity: 0.6,
  },
  oauthButtonText: {
    color: palette.muted,
    fontSize: fontSizes.md,
    fontWeight: '500',
    flex: 1,
  },
  comingSoonBadge: {
    backgroundColor: palette.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  comingSoonText: {
    fontSize: fontSizes.xs,
    color: palette.textSecondary,
  },
});
