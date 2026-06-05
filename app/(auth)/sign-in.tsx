import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth';
import type { OAuthProvider } from '@/lib/auth';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';

const PRIVACY_URL = 'https://groopay.vercel.app/privacy';
const TERMS_URL = 'https://groopay.vercel.app/terms';

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
    <View style={styles.root}>
      <LinearGradient
        colors={['#4F46E5', '#7C3AED']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={styles.gradient}
      >
        {/* ── Hero Section (top ~60%) ── */}
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoLetter}>G</Text>
          </View>
          <Text style={styles.appName}>{t('auth.appName')}</Text>
          <Text style={styles.tagline}>{t('auth.tagline')}</Text>
        </View>

        {/* ── Card Section (bottom ~40%) ── */}
        <View style={styles.card}>
          {/* Google Button */}
          <TouchableOpacity
            style={[styles.oauthButton, styles.googleButton, isBusy && styles.buttonDisabled]}
            onPress={() => handleOAuth('google')}
            activeOpacity={0.7}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={t('auth.googleSignIn')}
          >
            {inProgress === 'google' ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#4285F4" />
                <Text style={styles.googleButtonText}>{t('auth.googleSignIn')}</Text>
                <View style={{ width: 20 }} />
              </>
            )}
          </TouchableOpacity>

          {/* Apple Button */}
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
                <Text style={styles.appleButtonText}>{t('auth.appleSignIn')}</Text>
                <View style={{ width: 22 }} />
              </>
            )}
          </TouchableOpacity>

          {/* Expo Go notice */}
          {Platform.OS !== 'web' && (
            <Text style={styles.oauthNotice}>{t('auth.oauthNotice')}</Text>
          )}

          {/* DEV-only: Test user button */}
          {__DEV__ && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('auth.devSection')}</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[styles.devButton, isBusy && styles.buttonDisabled]}
                onPress={handleDevSignIn}
                activeOpacity={0.7}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel={t('auth.devSignIn')}
              >
                {inProgress === 'anon' ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons name="flask-outline" size={18} color={Colors.primary} />
                    <Text style={styles.devButtonText}>{t('auth.devSignIn')}</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.devNotice}>{t('auth.devNotice')}</Text>
            </>
          )}

          {/* Legal disclaimer */}
          <Text style={styles.legalText}>
            {t('auth.legalDisclaimer', {
              terms: t('auth.termsLink'),
              privacy: t('auth.privacyLink'),
            })}
          </Text>
          <View style={styles.legalLinks}>
            <TouchableOpacity
              onPress={() => Linking.openURL(TERMS_URL)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="link"
              accessibilityLabel={t('auth.termsLink')}
            >
              <Text style={styles.legalLink}>{t('auth.termsLink')}</Text>
            </TouchableOpacity>
            <Text style={styles.legalSeparator}>·</Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(PRIVACY_URL)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="link"
              accessibilityLabel={t('auth.privacyLink')}
            >
              <Text style={styles.legalLink}>{t('auth.privacyLink')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gradient: { flex: 1 },

  // ── Hero ──
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Spacing['2xl'],
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  logoLetter: {
    fontFamily: Typography.fontDisplayBold,
    fontSize: 40,
    color: '#FFFFFF',
  },
  appName: {
    fontFamily: Typography.fontDisplayBold,
    fontSize: 32,
    color: '#FFFFFF',
    letterSpacing: Typography.letterSpacing.tight,
    marginBottom: Spacing.sm,
  },
  tagline: {
    fontFamily: Typography.fontBody,
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },

  // ── Card ──
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['4xl'],
    alignItems: 'center',
  },

  // ── Buttons ──
  oauthButton: {
    width: '100%',
    maxWidth: 340,
    height: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: Spacing.sm,
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  googleButtonText: {
    fontFamily: Typography.fontBodyMedium,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  appleButtonText: {
    fontFamily: Typography.fontBodyMedium,
    fontSize: 16,
    color: '#FFFFFF',
  },
  buttonDisabled: { opacity: 0.6 },

  // ── OAuth notice ──
  oauthNotice: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },

  // ── Divider ──
  divider: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Typography.fontBody,
  },

  // ── Dev button ──
  devButton: {
    width: '100%',
    maxWidth: 340,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryGhost,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    borderRadius: 14,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    minHeight: 44,
  },
  devButtonText: {
    fontFamily: Typography.fontBodyMedium,
    fontSize: 14,
    color: Colors.primary,
  },
  devNotice: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },

  // ── Legal ──
  legalText: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  legalLink: {
    fontFamily: Typography.fontBodyMedium,
    fontSize: 12,
    color: Colors.primary,
  },
  legalSeparator: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
});
