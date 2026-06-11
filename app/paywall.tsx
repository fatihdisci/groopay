import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth';
import type { OAuthProvider } from '@/lib/auth';
import {
  isRevenueCatAvailable,
  initRevenueCat,
  getOfferings,
  purchaseUserPro,
  restorePurchases,
  type OfferingsResult,
} from '@/lib/revenuecat';
import { usePro } from '@/hooks/usePro';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';

type ProFeature = { icon: keyof typeof Ionicons.glyphMap; labelKey: string };

const PRO_FEATURES: ProFeature[] = [
  { icon: 'stats-chart-outline', labelKey: 'paywall.features.dashboard' },
  { icon: 'add-circle-outline', labelKey: 'paywall.features.unlimitedGroups' },
  { icon: 'pie-chart-outline', labelKey: 'paywall.features.categoryAnalytics' },
];

export default function PaywallScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const {
    user,
    isAnonymous,
    guestUpgradeForPurchase,
    signInWithExistingOAuthAccount,
    refreshProfile,
  } = useAuth();
  const { isUserPro } = usePro();

  const params = useLocalSearchParams<{ context?: string; groupId?: string }>();
  const context = params.context ?? 'feature';
  const legalPathPrefix = i18n.language.startsWith('en') ? '/en' : '';
  const privacyPolicyUrl = `https://groopay.vercel.app${legalPathPrefix}/privacy`;
  const termsOfUseUrl = `https://groopay.vercel.app${legalPathPrefix}/terms`;

  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<OfferingsResult | null>(null);
  const [offeringsLoaded, setOfferingsLoaded] = useState(false);
  const [priceTimeout, setPriceTimeout] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setPriceTimeout(true);
    }, 5000);

    (async () => {
      const off = await getOfferings();
      if (cancelled) return;
      clearTimeout(timeout);
      setOfferings(off);
      setOfferingsLoaded(true);
      if (__DEV__) {
        console.log('[paywall] offerings loaded:', !!off);
        console.log('[paywall] userPro:', off?.userPro ? {
          id: off.userPro.id,
          title: off.userPro.title,
          price: off.userPro.price,
          priceString: off.userPro.priceString,
          currencyCode: off.userPro.currencyCode,
        } : 'null');
        console.log('[paywall] isRevenueCatAvailable:', isRevenueCatAvailable());
        console.log('[paywall] platform:', Platform.OS, Platform.Version);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  const openLinkOrAlert = async (url: string, label: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(t('common.close'), `${label}: ${url}`);
      }
    } catch {
      Alert.alert(t('common.close'), `${label}: ${url}`);
    }
  };

  // RevenueCat webhook → DB activation can take longer than a few seconds
  // (especially in sandbox/TestFlight) — poll up to ~30 s.
  const waitForProActivation = async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      if (await refreshProfile()) return true;
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 2000);
      });
    }
    return false;
  };

  const purchaseUserProNow = async (expectedUserId?: string) => {
    if (!offerings?.userPro?.id) {
      Alert.alert(t('paywall.unavailable'), t('paywall.noProduct'));
      return false;
    }
    if (!isRevenueCatAvailable()) {
      Alert.alert(t('paywall.devBuildTitle'), t('paywall.devBuildMessage'));
      return false;
    }

    // The purchase must be attributed to the CURRENT Supabase user.
    // After a guest → existing-account switch the RevenueCat SDK may still
    // be logged in as the old anonymous user; await the logIn here so the
    // webhook grants Pro to the right profile.
    const purchaseUserId = expectedUserId ?? user?.id;
    if (!purchaseUserId) {
      Alert.alert(t('paywall.errorTitle'), t('paywall.accountSyncError'));
      return false;
    }
    await initRevenueCat(purchaseUserId);

    const result = await purchaseUserPro(offerings.userPro.id, purchaseUserId);
    if (result.devBuildRequired) {
      Alert.alert(t('paywall.devBuildTitle'), t('paywall.devBuildMessage'));
    } else if (result.error === 'account_mismatch') {
      Alert.alert(t('paywall.errorTitle'), t('paywall.accountSyncError'));
    } else if (result.success) {
      if (!result.entitlementActive) {
        Alert.alert(t('paywall.errorTitle'), t('paywall.purchaseNotVerified'));
        return false;
      }
      const activated = await waitForProActivation();
      Alert.alert(
        t('paywall.successTitle'),
        activated ? t('paywall.userProSuccess') : t('paywall.activationTimeout'),
        [
          { text: t('paywall.ok'), onPress: () => router.back() },
        ],
      );
    } else if (result.error !== 'cancelled') {
      console.log('[paywall] purchase error:', result.error);
      Alert.alert(t('paywall.errorTitle'), t('paywall.purchaseFailed'));
    }
    return result.success;
  };

  const handleGuestUpgrade = async (provider: OAuthProvider) => {
    setPurchasing('user');
    try {
      const upgradeResult = await guestUpgradeForPurchase(provider);

      if (__DEV__) {
        console.log('[paywall] guestUpgradeForPurchase result:', {
          status: upgradeResult.status,
          provider: upgradeResult.provider,
          hasAppleCredential: !!(upgradeResult.appleRetryToken && upgradeResult.appleRetryNonce),
        });
      }

      // ── Success: identity linked, proceed to purchase ──
      if (upgradeResult.status === 'linked') {
        if (__DEV__) console.log('[paywall] guestUpgradePath: linked, purchaseStarted: true');
        await purchaseUserProNow(upgradeResult.userId);
        return;
      }

      // ── User cancelled OAuth ──
      if (upgradeResult.status === 'cancelled') {
        if (__DEV__) console.log('[paywall] guestUpgradePath: cancelled, purchaseStarted: false');
        return;
      }

      // ── Identity already linked to another account ──
      if (upgradeResult.status === 'already_exists') {
        if (__DEV__) console.log('[paywall] guestUpgradePath: already_exists, showing confirmation');
        // Show friendly confirmation instead of technical error
        const userChoice = await new Promise<'continue' | 'cancel'>((resolve) => {
          Alert.alert(
            t('paywall.existingAccountTitle'),
            t('paywall.existingAccountMessage'),
            [
              { text: t('paywall.cancelUpgrade'), style: 'cancel', onPress: () => resolve('cancel') },
              { text: t('paywall.continueWithExistingAccount'), onPress: () => resolve('continue') },
            ],
          );
        });

        if (userChoice === 'cancel') {
          if (__DEV__) console.log('[paywall] guestUpgradePath: existing_account_cancelled, purchaseStarted: false');
          return;
        }

        // User confirmed — sign in with the existing account
        if (__DEV__) console.log('[paywall] guestUpgradePath: existing_account_confirmed, signing in...');
        const signedInUserId = await signInWithExistingOAuthAccount(
          provider,
          upgradeResult.appleRetryToken,
          upgradeResult.appleRetryNonce,
        );

        if (signedInUserId) {
          if (__DEV__) {
            console.log('[paywall] guestUpgradePath: existing_account_confirmed, purchaseStarted: true');
            console.log('[paywall]   purchasing as user_id:', signedInUserId);
          }
          await purchaseUserProNow(signedInUserId);
        } else {
          // Sign-in with existing account failed (e.g. Apple credential expired)
          if (__DEV__) console.log('[paywall] guestUpgradePath: existing_account_confirmed but sign-in failed');
          if (provider === 'apple') {
            Alert.alert(t('paywall.appleRetryTitle'), t('paywall.appleRetryMessage'));
          }
        }
        return;
      }

      // ── Other error: show a clean message, not a raw technical error ──
      if (__DEV__) {
        console.log('[paywall] guestUpgradePath: failed');
        console.log('[paywall]   error:', upgradeResult.errorMessage);
      }
      Alert.alert(t('paywall.errorTitle'), t('paywall.guestUpgradeFailed'));
    } catch (error: unknown) {
      if (__DEV__) {
        console.log('[paywall] guestUpgradePath: failed (unexpected throw)');
        console.log('[paywall]   error:', error);
      }
      Alert.alert(t('paywall.errorTitle'), t('paywall.guestUpgradeFailed'));
    } finally {
      setPurchasing(null);
    }
  };

  const handlePurchaseUserPro = async () => {
    if (isAnonymous) {
      Alert.alert(t('paywall.title'), t('paywall.guestSignInRequired'), [
        {
          text: t('auth.googleSignIn'),
          onPress: () => {
            void handleGuestUpgrade('google');
          },
        },
        {
          text: t('auth.appleSignIn'),
          onPress: () => {
            void handleGuestUpgrade('apple');
          },
        },
        { text: t('groups.cancel'), style: 'cancel' },
      ]);
      return;
    }

    setPurchasing('user');
    try {
      await purchaseUserProNow();
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    if (!isRevenueCatAvailable()) {
      Alert.alert(t('paywall.devBuildTitle'), t('paywall.devBuildMessage'));
      return;
    }
    if (!user?.id) {
      Alert.alert(t('paywall.errorTitle'), t('paywall.accountSyncError'));
      return;
    }

    setPurchasing('restore');
    try {
      // Restore links the App Store receipt to the RevenueCat app user —
      // make sure that is the current Supabase user before restoring.
      await initRevenueCat(user.id);
      const result = await restorePurchases(user.id);
      if (result.devBuildRequired) {
        Alert.alert(t('paywall.devBuildTitle'), t('paywall.devBuildMessage'));
      } else if (result.error === 'account_mismatch') {
        Alert.alert(t('paywall.errorTitle'), t('paywall.accountSyncError'));
      } else if (result.success) {
        const activated = await waitForProActivation();
        Alert.alert(
          t('paywall.restoreTitle'),
          activated ? t('paywall.restoreSuccess') : t('paywall.activationTimeout'),
          [
            { text: t('paywall.ok'), onPress: () => router.back() },
          ],
        );
      } else {
        Alert.alert(t('paywall.restoreTitle'), t('paywall.restoreEmpty'));
      }
    } finally {
      setPurchasing(null);
    }
  };

  const userProPrice = offerings?.userPro?.priceString;
  const isWaitingForPrice = !offeringsLoaded && !priceTimeout;
  const isPriceUnavailable = priceTimeout || (offeringsLoaded && !userProPrice);
  const isPurchaseDisabled = purchasing !== null || isWaitingForPrice || isPriceUnavailable;

  // ── Already Pro ──
  if (isUserPro) {
    return (
      <View style={styles.alreadyContainer}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Ionicons name="checkmark-circle" size={72} color={Colors.credit} />
        <Text style={styles.alreadyTitle}>{t('paywall.alreadyPro')}</Text>
        <Text style={styles.alreadySub}>{t('paywall.alreadyProSub')}</Text>
        <TouchableOpacity
          style={styles.alreadyBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('paywall.ok')}
        >
          <Text style={styles.alreadyBtnText}>{t('paywall.ok')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Paywall ──
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Close button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => router.back()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      >
        <Ionicons name="close" size={24} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>

      {/* Header */}
      <LinearGradient
        colors={['#4F46E5', '#7C3AED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.diamondIcon}>
          <Ionicons name="diamond" size={40} color="white" />
        </View>
        <Text style={styles.title}>{t('paywall.title')}</Text>
        <Text style={styles.subtitle}>{t('paywall.subtitle')}</Text>
      </LinearGradient>

      {/* Feature rows — open, no box */}
      <View style={styles.featuresSection}>
        {PRO_FEATURES.map((f, i) => (
          <View key={f.labelKey} style={[styles.featureRow, i > 0 && styles.featureRowBorder]}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon} size={22} color={Colors.primary} />
            </View>
            <Text style={styles.featureText}>{t(f.labelKey)}</Text>
          </View>
        ))}
      </View>

      {/* User Pro price card */}
      <View style={styles.priceCard}>
        <View style={styles.priceRow}>
          <View style={styles.priceLeft}>
            <Text style={styles.priceTitle}>{t('paywall.userProTitle')}</Text>
            <View style={styles.monthlyBadge}>
              <Text style={styles.monthlyBadgeText}>{t('paywall.monthly')}</Text>
            </View>
          </View>
          {offeringsLoaded && userProPrice ? (
            <Text style={styles.priceValue}>{userProPrice}</Text>
          ) : isPriceUnavailable ? (
            <Text style={styles.priceError}>{t('paywall.priceError')}</Text>
          ) : (
            <ActivityIndicator size="small" color={Colors.primary} />
          )}
        </View>
        <Text style={styles.priceDesc}>{t('paywall.userProDetail')}</Text>

        {context === 'limit' && (
          <View style={styles.limitNote}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.warning} />
            <Text style={styles.limitNoteText}>{t('paywall.limitNote')}</Text>
          </View>
        )}
      </View>

      {/* Legal links — ABOVE purchase CTA (Apple 3.1.2(c): must be visible before tapping purchase) */}
      <View style={styles.legalLinks}>
        <TouchableOpacity
          onPress={() => openLinkOrAlert(privacyPolicyUrl, t('paywall.privacyPolicy'))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="link"
          accessibilityLabel={t('paywall.privacyPolicy')}
        >
          <Text style={styles.legalLinkText}>{t('paywall.privacyPolicy')}</Text>
        </TouchableOpacity>
        <Text style={styles.legalLinkSeparator}> · </Text>
        <TouchableOpacity
          onPress={() => openLinkOrAlert(termsOfUseUrl, t('paywall.terms'))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="link"
          accessibilityLabel={t('paywall.terms')}
        >
          <Text style={styles.legalLinkText}>{t('paywall.terms')}</Text>
        </TouchableOpacity>
      </View>

      {/* CTA Button */}
      <TouchableOpacity
        style={[styles.ctaButton, isPurchaseDisabled && styles.ctaButtonDisabled]}
        onPress={handlePurchaseUserPro}
        disabled={isPurchaseDisabled}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('paywall.purchaseUserPro', { price: userProPrice ? ` — ${userProPrice}` : '' })}
      >
        {purchasing === 'user' ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.ctaButtonText}>
            {offeringsLoaded
              ? t('paywall.purchaseUserPro', { price: userProPrice ? ` — ${userProPrice}` : '' })
              : t('paywall.loading')}
          </Text>
        )}
      </TouchableOpacity>

      {/* Restore */}
      <TouchableOpacity
        style={styles.restoreButton}
        onPress={handleRestore}
        disabled={purchasing !== null}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('paywall.restore')}
      >
        {purchasing === 'restore' ? (
          <ActivityIndicator size="small" color={Colors.textTertiary} />
        ) : (
          <Text style={styles.restoreText}>{t('paywall.restore')}</Text>
        )}
      </TouchableOpacity>

      {/* Dev build notice */}
      {!isRevenueCatAvailable() && (
        <View style={styles.devNotice}>
          <Ionicons name="construct-outline" size={14} color={Colors.warning} />
          <Text style={styles.devNoticeText}>{t('paywall.devBuildNotice')}</Text>
        </View>
      )}

      <Text style={styles.finePrint}>{t('paywall.finePrint')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#4F46E5' },
  content: {
    paddingHorizontal: 0, paddingTop: 0, paddingBottom: 48,
    backgroundColor: Colors.background,
    maxWidth: 600, width: '100%', alignSelf: 'center',
  },
  closeButton: { position: 'absolute', top: 16, right: 16, padding: 8, zIndex: 10 },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 36,
    paddingHorizontal: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 36,
  },
  diamondIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: { fontFamily: Typography.fontDisplayBold, fontSize: 28, color: 'white', textAlign: 'center' },
  subtitle: { fontFamily: Typography.fontBody, fontSize: 15, color: 'rgba(255,255,255,0.82)', marginTop: 8, textAlign: 'center', lineHeight: 22 },

  // Features — open rows
  featuresSection: { marginHorizontal: 24, marginBottom: 32 },
  featureRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, gap: 14,
  },
  featureRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  featureIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.primaryGhost,
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { flex: 1, fontFamily: Typography.fontBody, fontSize: 15, color: Colors.textPrimary, lineHeight: 21 },

  // Price card — soft shadow, no harsh border
  priceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 20,
    marginHorizontal: 24,
    ...Shadows.md,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  priceLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceTitle: { fontFamily: Typography.fontDisplayMedium, fontSize: 18, color: Colors.textPrimary },
  monthlyBadge: {
    backgroundColor: Colors.primaryGhost,
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: Radius.full,
  },
  monthlyBadgeText: { fontFamily: Typography.fontBodyBold, fontSize: 12, color: Colors.primary },
  priceValue: { fontFamily: Typography.fontDisplayBold, fontSize: 22, color: Colors.primary },
  priceError: { fontFamily: Typography.fontDisplayMedium, fontSize: 14, color: Colors.warning, textAlign: 'right' },
  priceDesc: { fontFamily: Typography.fontBody, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },

  // Limit note
  limitNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 12, padding: 12,
    backgroundColor: '#FFF7ED', borderRadius: Radius.sm,
  },
  limitNoteText: { flex: 1, fontFamily: Typography.fontBodyMedium, fontSize: 13, color: Colors.warning },

  // CTA Button
  ctaButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 16,
    marginHorizontal: 24,
    ...Shadows.md,
  },
  ctaButtonDisabled: { opacity: 0.6 },
  ctaButtonText: { fontFamily: Typography.fontBodyBold, fontSize: 17, color: 'white' },

  // Restore
  restoreButton: {
    alignItems: 'center', paddingVertical: 16,
    minHeight: 44, justifyContent: 'center',
  },
  restoreText: { fontFamily: Typography.fontBodyMedium, fontSize: 14, color: Colors.textTertiary },

  // Dev notice
  devNotice: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, marginBottom: 16,
  },
  devNoticeText: { fontFamily: Typography.fontBody, fontSize: 12, color: Colors.warning },

  // Legal links — ABOVE CTA, clearly visible before tapping purchase (Apple 3.1.2(c))
  legalLinks: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 24,
    marginTop: 0, marginBottom: 4,
  },
  legalLinkText: {
    fontFamily: Typography.fontBodyMedium, fontSize: 14,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  legalLinkSeparator: {
    fontFamily: Typography.fontBody, fontSize: 14,
    color: Colors.textTertiary,
    marginHorizontal: 8,
  },

  // Fine print
  finePrint: {
    fontFamily: Typography.fontBody, fontSize: 11,
    color: Colors.textTertiary, textAlign: 'center',
    lineHeight: 16,
  },

  // Already Pro
  alreadyContainer: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  alreadyTitle: { fontFamily: Typography.fontDisplayBold, fontSize: 24, color: Colors.textPrimary, marginTop: 16 },
  alreadySub: { fontFamily: Typography.fontBody, fontSize: 15, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' },
  alreadyBtn: {
    marginTop: 24, backgroundColor: Colors.primary,
    borderRadius: 14, paddingHorizontal: 40, paddingVertical: 14,
    minHeight: 44, justifyContent: 'center',
  },
  alreadyBtnText: { fontFamily: Typography.fontBodyBold, fontSize: 16, color: 'white' },
});
