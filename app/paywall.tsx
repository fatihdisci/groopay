import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  isRevenueCatAvailable,
  getOfferings,
  purchaseUserPro,
  restorePurchases,
  type OfferingsResult,
} from '@/lib/revenuecat';
import { useAuth } from '@/lib/auth';
import { usePro } from '@/hooks/usePro';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { palette, spacing, fontSizes, radii, minTouchTarget } from '@/constants/theme';

type ProFeature = { icon: keyof typeof Ionicons.glyphMap; labelKey: string };

const PRO_FEATURES: ProFeature[] = [
  { icon: 'stats-chart-outline', labelKey: 'paywall.features.dashboard' },
  { icon: 'add-circle-outline', labelKey: 'paywall.features.unlimitedGroups' },
  { icon: 'pie-chart-outline', labelKey: 'paywall.features.categoryAnalytics' },
];

export default function PaywallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isUserPro } = usePro();

  const params = useLocalSearchParams<{ context?: string; groupId?: string }>();
  const context = params.context ?? 'feature';

  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<OfferingsResult | null>(null);
  const [offeringsLoaded, setOfferingsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const off = await getOfferings();
      setOfferings(off);
      setOfferingsLoaded(true);
    })();
  }, []);

  const handlePurchaseUserPro = async () => {
    if (!offerings?.userPro?.id) {
      Alert.alert(t('paywall.unavailable'), t('paywall.noProduct'));
      return;
    }
    if (!isRevenueCatAvailable()) {
      Alert.alert(t('paywall.devBuildTitle'), t('paywall.devBuildMessage'));
      return;
    }

    setPurchasing('user');
    try {
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

  // ── Already Pro ──
  if (isUserPro) {
    return (
      <View style={styles.alreadyContainer}>
        <Ionicons name="checkmark-circle" size={72} color={Colors.credit} />
        <Text style={styles.alreadyTitle}>{t('paywall.alreadyPro')}</Text>
        <Text style={styles.alreadySub}>{t('paywall.alreadyProSub')}</Text>
        <TouchableOpacity style={styles.alreadyBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.alreadyBtnText}>{t('paywall.ok')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Paywall ──
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.diamondIcon}>
          <Ionicons name="diamond" size={36} color={Colors.primary} />
        </View>
        <Text style={styles.title}>{t('paywall.title')}</Text>
        <Text style={styles.subtitle}>{t('paywall.subtitle')}</Text>
      </View>

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
          ) : (
            <Text style={styles.priceLoading}>{t('paywall.loading')}</Text>
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
        style={[styles.ctaButton, purchasing === 'user' && styles.ctaButtonDisabled]}
        onPress={handlePurchaseUserPro}
        disabled={purchasing !== null || !offeringsLoaded}
        activeOpacity={0.85}
      >
        {purchasing === 'user' ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.ctaButtonText}>
            {offeringsLoaded
              ? t('paywall.purchaseUserPro', { price: '' })
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
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 48 },

  // Header
  header: { alignItems: 'center', marginBottom: 40 },
  diamondIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primaryGhost,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: { fontFamily: Typography.fontDisplayBold, fontSize: 28, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontFamily: Typography.fontBody, fontSize: 16, color: Colors.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 22 },

  // Features — open rows
  featuresSection: { marginBottom: 32 },
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
  priceLoading: { fontFamily: Typography.fontDisplayMedium, fontSize: 16, color: Colors.textTertiary },
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
    minHeight: minTouchTarget,
    marginTop: 20,
    ...Shadows.md,
  },
  ctaButtonDisabled: { opacity: 0.6 },
  ctaButtonText: { fontFamily: Typography.fontBodyBold, fontSize: 17, color: 'white' },

  // Restore
  restoreButton: {
    alignItems: 'center', paddingVertical: 16,
    minHeight: minTouchTarget, justifyContent: 'center',
  },
  restoreText: { fontFamily: Typography.fontBodyMedium, fontSize: 14, color: Colors.textTertiary },

  // Dev notice
  devNotice: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, marginBottom: 16,
  },
  devNoticeText: { fontFamily: Typography.fontBody, fontSize: 12, color: Colors.warning },

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
    padding: 40,
  },
  alreadyTitle: { fontFamily: Typography.fontDisplayBold, fontSize: 24, color: Colors.textPrimary, marginTop: 16 },
  alreadySub: { fontFamily: Typography.fontBody, fontSize: 15, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' },
  alreadyBtn: {
    marginTop: 24, backgroundColor: Colors.primary,
    borderRadius: 14, paddingHorizontal: 40, paddingVertical: 14,
    minHeight: minTouchTarget, justifyContent: 'center',
  },
  alreadyBtnText: { fontFamily: Typography.fontBodyBold, fontSize: 16, color: 'white' },
});
