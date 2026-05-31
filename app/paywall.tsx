import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  isRevenueCatAvailable,
  getOfferings,
  purchaseGroupPro,
  purchaseUserPro,
  restorePurchases,
  type OfferingsResult,
} from '@/lib/revenuecat';
import { useAuth } from '@/lib/auth';
import { usePro } from '@/hooks/usePro';
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
  const { user } = useAuth();
  const { isUserPro } = usePro();

  const params = useLocalSearchParams<{ context?: string; groupId?: string }>();
  const context = params.context ?? 'feature';
  const groupId = params.groupId;

  const [purchasing, setPurchasing] = useState<string | null>(null); // 'group' | 'user' | 'restore'
  const [offerings, setOfferings] = useState<OfferingsResult | null>(null);
  const [offeringsLoaded, setOfferingsLoaded] = useState(false);

  // Load offerings on mount
  useEffect(() => {
    (async () => {
      const off = await getOfferings();
      setOfferings(off);
      setOfferingsLoaded(true);
    })();
  }, []);

  const highlightUserPro = context === 'limit';
  const hasGroupContext = (context === 'group-pro' || context === 'feature') && !!groupId;

  const handlePurchaseGroupPro = async () => {
    if (!offerings?.groupPro?.id) {
      Alert.alert(t('paywall.unavailable'), t('paywall.noProduct'));
      return;
    }
    if (!isRevenueCatAvailable()) {
      Alert.alert(t('paywall.devBuildTitle'), t('paywall.devBuildMessage'));
      return;
    }
    if (!groupId) {
      Alert.alert(t('paywall.errorTitle'), t('paywall.missingGroup'));
      return;
    }

    setPurchasing('group');
    try {
      const result = await purchaseGroupPro(offerings.groupPro.id, groupId);
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

  const formatPrice = (priceString: string | undefined): string => {
    if (!priceString) return '';
    // RevenueCat returns localized price string
    return priceString;
  };

  const userProPrice = offerings?.userPro?.priceString;
  const groupProPrice = offerings?.groupPro?.priceString;

  if (isUserPro) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.alreadyPro}>
          <Ionicons name="checkmark-circle" size={64} color={palette.success} />
          <Text style={styles.alreadyProTitle}>{t('paywall.alreadyPro')}</Text>
          <Text style={styles.alreadyProSub}>{t('paywall.alreadyProSub')}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t('paywall.ok')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="diamond" size={48} color={palette.primary} />
        <Text style={styles.title}>{t('paywall.title')}</Text>
        <Text style={styles.subtitle}>{t('paywall.subtitle')}</Text>
      </View>

      {/* Features */}
      <View style={styles.featuresCard}>
        <Text style={styles.featuresTitle}>{t('paywall.proFeatures')}</Text>
        {PRO_FEATURES.map((f) => (
          <View key={f.labelKey} style={styles.featureRow}>
            <Ionicons name={f.icon} size={20} color={palette.primary} />
            <Text style={styles.featureText}>{t(f.labelKey)}</Text>
          </View>
        ))}
      </View>

      {/* User Pro Option — the only Pro tier */}
      <View style={[styles.optionCard, styles.optionHighlighted]}>
        {highlightUserPro && (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>{t('paywall.recommended')}</Text>
          </View>
        )}
        <View style={styles.optionHeader}>
          <Ionicons name="diamond" size={24} color={palette.primary} />
          <View style={styles.optionInfo}>
            <View style={styles.optionTitleRow}>
              <Text style={styles.optionTitle}>{t('paywall.userProTitle')}</Text>
              <View style={styles.monthlyBadge}>
                <Text style={styles.monthlyBadgeText}>{t('paywall.monthly')}</Text>
              </View>
            </View>
            <Text style={styles.optionDesc}>{t('paywall.userProDesc')}</Text>
          </View>
        </View>
        {highlightUserPro && (
          <Text style={styles.limitNote}>{t('paywall.limitNote')}</Text>
        )}
        <Text style={styles.optionDetail}>{t('paywall.userProDetail')}</Text>
        <TouchableOpacity
          style={[styles.buyButton, purchasing === 'user' && styles.buyButtonDisabled]}
          onPress={handlePurchaseUserPro}
          disabled={purchasing !== null || !offeringsLoaded}
          activeOpacity={0.7}
        >
          {purchasing === 'user' ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.buyButtonText}>
              {offeringsLoaded
                ? t('paywall.purchaseUserPro', { price: formatPrice(userProPrice) })
                : t('paywall.loading')}
              </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Restore */}
      <TouchableOpacity
        style={styles.restoreButton}
        onPress={handleRestore}
        disabled={purchasing !== null}
        activeOpacity={0.7}
      >
        {purchasing === 'restore' ? (
          <ActivityIndicator size="small" color={palette.muted} />
        ) : (
          <Text style={styles.restoreText}>{t('paywall.restore')}</Text>
        )}
      </TouchableOpacity>

      {/* Dev build notice if not available */}
      {!isRevenueCatAvailable() && (
        <View style={styles.devNotice}>
          <Ionicons name="construct-outline" size={16} color={palette.warning} />
          <Text style={styles.devNoticeText}>{t('paywall.devBuildNotice')}</Text>
        </View>
      )}

      <Text style={styles.finePrint}>{t('paywall.finePrint')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { alignItems: 'center', marginBottom: spacing.lg, paddingTop: spacing.md },
  title: { fontSize: fontSizes.xxl, fontWeight: '700', color: palette.text, marginTop: spacing.md },
  subtitle: { fontSize: fontSizes.md, color: palette.textSecondary, marginTop: spacing.sm, textAlign: 'center' },

  // Features
  featuresCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  featuresTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: palette.text, marginBottom: spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  featureText: { fontSize: fontSizes.md, color: palette.textSecondary, flex: 1 },

  // Options
  optionCard: {
    backgroundColor: palette.background,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  optionHighlighted: {
    borderColor: palette.primary,
    borderWidth: 2,
    backgroundColor: palette.primary + '08',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    right: spacing.md,
    backgroundColor: palette.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  recommendedText: { fontSize: fontSizes.xs, fontWeight: '700', color: 'white' },
  optionHeader: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  optionInfo: { flex: 1 },
  optionTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: palette.text },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthlyBadge: {
    backgroundColor: palette.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  monthlyBadgeText: { fontSize: fontSizes.xs, fontWeight: '600', color: palette.primary },
  optionDesc: { fontSize: fontSizes.sm, color: palette.textSecondary, marginTop: 2 },
  optionDetail: { fontSize: fontSizes.sm, color: palette.textSecondary, marginBottom: spacing.md, lineHeight: fontSizes.sm * 1.5 },
  limitNote: {
    fontSize: fontSizes.sm,
    color: palette.warning,
    fontWeight: '600',
    marginBottom: spacing.sm,
    backgroundColor: palette.warning + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },

  // Buttons
  buyButton: {
    backgroundColor: palette.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  buyButtonSecondary: {
    backgroundColor: palette.primaryDark,
  },
  buyButtonDisabled: { opacity: 0.6 },
  buyButtonText: { fontSize: fontSizes.md, fontWeight: '700', color: 'white' },

  // Restore
  restoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  restoreText: { fontSize: fontSizes.sm, color: palette.muted, fontWeight: '500' },

  // Dev notice
  devNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  devNoticeText: { fontSize: fontSizes.xs, color: palette.warning },

  finePrint: {
    fontSize: fontSizes.xs,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: fontSizes.xs * 1.6,
  },

  // Already Pro
  alreadyPro: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  alreadyProTitle: { fontSize: fontSizes.xxl, fontWeight: '700', color: palette.text, marginTop: spacing.md },
  alreadyProSub: { fontSize: fontSizes.md, color: palette.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
  backButton: {
    marginTop: spacing.lg,
    backgroundColor: palette.primary,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  backButtonText: { fontSize: fontSizes.md, fontWeight: '600', color: 'white' },
});
