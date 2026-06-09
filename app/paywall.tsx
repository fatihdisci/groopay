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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth';
import type { OAuthProvider } from '@/lib/auth';
import {
  isRevenueCatAvailable,
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
  const { t } = useTranslation();
  const router = useRouter();
  const { isAnonymous, signInWithProvider } = useAuth();
  const { isUserPro } = usePro();

  const params = useLocalSearchParams<{ context?: string; groupId?: string }>();
  const context = params.context ?? 'feature';

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
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  const purchaseUserProNow = async () => {
    if (!offerings?.userPro?.id) {
      Alert.alert(t('paywall.unavailable'), t('paywall.noProduct'));
      return false;
    }
    if (!isRevenueCatAvailable()) {
      Alert.alert(t('paywall.devBuildTitle'), t('paywall.devBuildMessage'));
      return false;
    }

    const result = await purchaseUserPro(offerings.userPro.id);
    if (result.devBuildRequired) {
      Alert.alert(t('paywall.devBuildTitle'), t('paywall.devBuildMessage'));
    } else if (result.success) {
      Alert.alert(t('paywall.successTitle'), t('paywall.userProSuccess'), [
        { text: t('paywall.ok'), onPress: () => router.back() },
      ]);
    } else if (result.error !== 'cancelled') {
      Alert.alert(t('paywall.errorTitle'), result.error);
    }
    return result.success;
  };

  const handleGuestUpgrade = async (provider: OAuthProvider) => {
    setPurchasing('user');
    try {
      const upgraded = await signInWithProvider(provider);
      if (!upgraded) return;
      await purchaseUserProNow();
    } catch (error: unknown) {
      console.error('[paywall] Guest identity upgrade failed:', error);
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

    setPurchasing('restore');
    try {
      const result = await restorePurchases();
      if (result.devBuildRequired) {
        Alert.alert(t('paywall.devBuildTitle'), t('paywall.devBuildMessage'));
      } else if (result.success) {
        Alert.alert(t('paywall.restoreTitle'), t('paywall.restoreSuccess'), [
          { text: t('paywall.ok'), onPress: () => router.back() },
        ]);
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
  const isPurchaseDisabled = purchasing !== null || isWaitingForPrice;

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

      {/* CTA Button */}
      <TouchableOpacity
        style={[styles.ctaButton, isPurchaseDisabled && styles.ctaButtonDisabled]}
        onPress={handlePurchaseUserPro}
        disabled={isPurchaseDisabled}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('paywall.purchaseUserPro', { price: userProPrice || '' })}
      >
        {purchasing === 'user' ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.ctaButtonText}>
            {offeringsLoaded
              ? t('paywall.purchaseUserPro', { price: userProPrice || '' })
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

      {/* Legal links */}
      <View style={styles.legalLinks}>
        <TouchableOpacity
          onPress={() => Linking.openURL('https://groopay.app/privacy')}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="link"
          accessibilityLabel={t('paywall.privacyPolicy')}
        >
          <Text style={styles.legalLinkText}>{t('paywall.privacyPolicy')}</Text>
        </TouchableOpacity>
        <Text style={styles.legalLinkText}> · </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL('https://groopay.app/terms')}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="link"
          accessibilityLabel={t('paywall.terms')}
        >
          <Text style={styles.legalLinkText}>{t('paywall.terms')}</Text>
        </TouchableOpacity>
      </View>

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
  content: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 48, backgroundColor: Colors.background },
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

  // Legal links
  legalLinks: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 24,
  },
  legalLinkText: {
    fontFamily: Typography.fontBody, fontSize: 11,
    color: Colors.textTertiary,
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
