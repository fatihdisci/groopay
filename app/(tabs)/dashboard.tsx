import React, { useState, useEffect, useLayoutEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { usePro } from '@/hooks/usePro';
import { useAuth } from '@/lib/auth';
import { getProDashboardAnalytics, type DashboardAnalyticsData } from '@/lib/supabase/queries';
import { supabase } from '@/lib/supabase/client';
import { computeBalances, groupByCurrency } from '@/lib/finance';
import { fromMinor, formatAmount } from '@/lib/finance/money';
import { CATEGORIES, CATEGORY_COLORS } from '@/lib/finance/categories';
import type { Category } from '@/lib/finance/categories';
import { FadeInUp } from '@/components/Animations';
import TipsButton from '@/components/TipsButton';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { palette, spacing, radii } from '@/constants/theme';
import type { ExpenseForBalance, SplitForBalance, SettlementForBalance } from '@/lib/finance';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { isUserPro } = usePro();

  // Currency selection
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);

  // Hero + stats data (always loaded)
  const { data: heroData, isLoading: heroLoading } = useQuery({
    queryKey: ['dashboard-hero', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: members } = await supabase
        .from('group_members')
        .select('id, group_id')
        .eq('user_id', user.id).eq('is_active', true);
      const memberRows = (members ?? []) as { id: string; group_id: string }[];
      const myMemberIds = new Set(memberRows.map((m) => m.id));
      const groupIds = [...new Set(memberRows.map((m) => m.group_id))];

      if (groupIds.length === 0) return { balances: [], groupCount: 0, expenseCount: 0, topGroup: null, categories: [], dominantCurrency: 'TRY', usedCurrencies: [] };

      const { data: groups } = await supabase.from('groups').select('id, name').in('id', groupIds);
      const [{ data: expenses }, { data: allSplits }, { data: settlements }] = await Promise.all([
        supabase.from('expenses').select('*').in('group_id', groupIds).is('deleted_at', null),
        (async () => {
          const { data: expIds } = await supabase.from('expenses').select('id').in('group_id', groupIds).is('deleted_at', null);
          const ids = (expIds ?? []).map((e: any) => e.id);
          if (ids.length === 0) return { data: [] };
          return supabase.from('expense_splits').select('*').in('expense_id', ids);
        })(),
        supabase.from('settlements').select('*').in('group_id', groupIds).eq('status', 'confirmed'),
      ]);

      const balances = computeBalances(
        (expenses ?? []) as unknown as ExpenseForBalance[],
        (allSplits ?? []) as unknown as SplitForBalance[],
        (settlements ?? []) as unknown as SettlementForBalance[],
      );
      const myBalances = balances.filter((b) => myMemberIds.has(b.memberId));
      const grouped = groupByCurrency(myBalances);
      const balanceResult = [...grouped.entries()].map(([currency, cb]) => {
        const totalMinor = cb.reduce((s, b) => s + b.netMinor, 0);
        if (totalMinor === 0) return null;
        const amt = fromMinor(Math.abs(totalMinor), currency);
        const formatted = new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amt);
        return { currency, netMinor: totalMinor, formatted };
      }).filter(Boolean) as { currency: string; netMinor: number; formatted: string }[];

      const expRows = (expenses ?? []) as any[];
      const groupCount = (groups ?? []).length;
      const expenseCount = expRows.length;

      const groupExpCounts = new Map<string, number>();
      for (const e of expRows) groupExpCounts.set(e.group_id, (groupExpCounts.get(e.group_id) ?? 0) + 1);
      let topGroup: { name: string; count: number } | null = null;
      for (const [gid, count] of groupExpCounts) {
        if (!topGroup || count > topGroup.count) {
          topGroup = { name: (groups ?? []).find((g: any) => g.id === gid)?.name ?? '?', count };
        }
      }

      const categorySplits = new Map<string, number>();
      for (const s of (allSplits ?? []) as any[]) {
        if (!myMemberIds.has(s.member_id)) continue;
        categorySplits.set(s.expense_id, (categorySplits.get(s.expense_id) ?? 0) + s.share_amount);
      }

      // Track per (category, currency) — NEVER mix currencies
      const catCurrencyMap = new Map<string, { total: number; currency: string }>();
      for (const e of expRows) {
        const cur = e.currency ?? 'TRY';
        const splitShare = categorySplits.get(e.id) ?? 0;
        const shareRatio = Number(e.amount) > 0 ? splitShare / Number(e.amount) : 0;
        const myShare = Number(e.amount) * shareRatio;
        if (myShare <= 0) continue;
        const key = `${e.category}::${cur}`;
        const existing = catCurrencyMap.get(key);
        if (existing) { existing.total += myShare; }
        else { catCurrencyMap.set(key, { total: myShare, currency: cur }); }
      }

      // Determine dominant currency
      const catCurrencyCounts: Record<string, number> = {};
      for (const [, item] of catCurrencyMap) {
        catCurrencyCounts[item.currency] = (catCurrencyCounts[item.currency] || 0) + item.total;
      }
      let dominantCatCurrency = 'TRY';
      let maxCatTotal = 0;
      for (const [cur, tot] of Object.entries(catCurrencyCounts)) {
        if (tot > maxCatTotal) { maxCatTotal = tot; dominantCatCurrency = cur; }
      }

      // Return ALL categories with currency info (client filters by selectedCurrency)
      const allCategories = [...catCurrencyMap.entries()]
        .map(([key, { total, currency }]) => ({ category: key.split('::')[0]!, amount: total, currency }))
        .sort((a, b) => b.amount - a.amount);

      const usedCurrencies = [...new Set([...catCurrencyMap.values()].map((v) => v.currency))];

      return { balances: balanceResult, groupCount, expenseCount, topGroup, categories: allCategories, dominantCurrency: dominantCatCurrency, usedCurrencies };
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // Sync selectedCurrency: preferred_currency wins, else auto-dominant on first load
  useEffect(() => {
    if (!heroData) return;
    const preferred = user?.preferred_currency;
    if (preferred) {
      setSelectedCurrency(preferred);
    } else if (selectedCurrency === null) {
      setSelectedCurrency(heroData.dominantCurrency);
    }
  }, [heroData, user?.preferred_currency]);

  // Dashboard tips button in header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ marginRight: 8 }}>
          <TipsButton
            title={t('tips.dashboard.title')}
            tips={[
              { icon: 'filter-outline' as const, text: t('tips.dashboard.tip1') },
              { icon: 'pie-chart-outline' as const, text: t('tips.dashboard.tip2') },
              { icon: 'star-outline' as const, text: t('tips.dashboard.tip3') },
              { icon: 'git-compare-outline' as const, text: t('tips.dashboard.tip4') },
            ]}
          />
        </View>
      ),
    });
  }, [navigation, t]);

  const activeCurrency = selectedCurrency ?? 'TRY';

  // Pro analytics (only for Pro users)
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['pro-analytics', user?.id, activeCurrency],
    queryFn: () => getProDashboardAnalytics(user!.id, activeCurrency),
    enabled: !!user?.id && isUserPro,
    staleTime: 60_000,
  });

  if (heroLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const d = heroData;
  const hasData = d && (d.balances.length > 0 || d.groupCount > 0);
  const heroAmountSize = (d?.balances.length ?? 0) >= 3 ? 28 : (d?.balances.length ?? 0) >= 2 ? 34 : 40;
  const chartData = analytics?.monthlyTrend?.map((item) => ({
    value: item.total,
    label: item.month,
    frontColor: Colors.primary,
  })) || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── HERO (FREE) ── */}
      <LinearGradient colors={[Colors.gradientStart, Colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
        <Text style={styles.heroLabel}>{t('dashboard.overallBalance')}</Text>
        {d && d.balances.length > 0 ? d.balances.map((b) => (
          <View key={b.currency} style={styles.heroRow}>
            <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>{b.currency}</Text></View>
            <Text style={[styles.heroAmount, { fontSize: heroAmountSize }]} numberOfLines={1} adjustsFontSizeToFit>{b.formatted}</Text>
            <Text style={[styles.heroStatus, b.netMinor > 0 ? styles.heroCredit : styles.heroDebt]}>
              {b.netMinor > 0 ? t('dashboard.alacak') : t('dashboard.borc')}
            </Text>
          </View>
        )) : <Text style={styles.heroEmpty}>{t('dashboard.noBalance')}</Text>}
      </LinearGradient>

      {/* ── Currency Selector ── */}
      {heroData && (heroData.usedCurrencies ?? []).length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.currencySelector} contentContainerStyle={styles.currencySelectorContent}>
          {heroData.usedCurrencies!.map((cur) => {
            const isActive = cur === activeCurrency;
            return (
              <TouchableOpacity
                key={cur}
                style={[styles.currencyChip, isActive && styles.currencyChipActive]}
                onPress={() => setSelectedCurrency(cur)}
                activeOpacity={0.7}
              >
                <Text style={[styles.currencyChipText, isActive && styles.currencyChipTextActive]}>{cur}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── STATS (FREE) ── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="people" size={20} color={Colors.primary} />
          <Text style={styles.statValue}>{d?.groupCount ?? 0}</Text>
          <Text style={styles.statLabel}>{t('dashboard.totalGroups')}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="receipt" size={20} color={Colors.primary} />
          <Text style={styles.statValue}>{d?.expenseCount ?? 0}</Text>
          <Text style={styles.statLabel}>{t('dashboard.totalExpenses')}</Text>
        </View>
      </View>
      {d?.topGroup && (
        <View style={styles.statCardWide}>
          <View style={styles.trophyIcon}>
            <Ionicons name="trophy-outline" size={18} color={Colors.warning} />
          </View>
          <View style={styles.statCardWideText}>
            <Text style={styles.statValueSmall} numberOfLines={1}>{d.topGroup.name}</Text>
            <Text style={styles.statLabelLeft} numberOfLines={1}>{t('dashboard.mostActiveGroup')} · {d.topGroup.count} {t('dashboard.expensesCount')}</Text>
          </View>
        </View>
      )}

      {/* ── FREE: Category Distribution ── */}
      <View style={styles.proSection}>
        <Text style={styles.sectionTitle}>
          {t('dashboard.categoryBreakdown')}{' '}
          <Text style={styles.currencyLabel}>({activeCurrency})</Text>
        </Text>
        {d && (() => {
          const filteredCats = d.categories.filter((c) => c.currency === activeCurrency).slice(0, 5);
          if (filteredCats.length > 0) {
            return (
              <View style={styles.categoryList}>
                {filteredCats.map((c) => {
                  const catColor = CATEGORY_COLORS[c.category as Category] ?? Colors.primary;
                  return (
                    <View key={c.category} style={styles.categoryRow}>
                      <View style={styles.categoryLeft}>
                        <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
                        <Text style={styles.categoryName}>{t(`categories.${c.category}`, c.category)}</Text>
                      </View>
                      <Text style={styles.categoryAmount}>
                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: activeCurrency, minimumFractionDigits: 2 }).format(c.amount)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          }
          return (
            <View style={styles.emptyCardSmall}>
              <Text style={styles.emptySmallText}>{t('dashboard.noBalance')}</Text>
            </View>
          );
        })()}
        {(heroData?.usedCurrencies.length ?? 0) > 1 && (
          <Text style={styles.otherCurrencyNote}>
            {t('dashboard.otherCurrencyNote', { currency: activeCurrency })}
          </Text>
        )}
      </View>

      {/* ── PRO: Spending Trend (BarChart) / FREE: blurred placeholder ── */}
      {isUserPro ? (
        <FadeInUp duration={600}>
          <View style={styles.proSection}>
            <Text style={styles.sectionTitle}>
              {t('dashboard.trends')}{' '}
              <Text style={styles.currencyLabel}>({activeCurrency})</Text>
            </Text>
            {analyticsLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ paddingVertical: 30 }} />
            ) : chartData.length > 0 ? (
              <View style={styles.chartCard}>
                <Text style={styles.chartCurrencyLabel}>{t('dashboard.monthlySpending', { currency: activeCurrency })}</Text>
                <SimpleBarChart data={chartData} />
                <Text style={styles.chartCurrencyNote}>{t('dashboard.trendSingleCurrency', { currency: activeCurrency })}</Text>
              </View>
            ) : (
              <View style={styles.emptyCardSmall}><Text style={styles.emptySmallText}>{t('dashboard.noBalance')}</Text></View>
            )}
          </View>

          {/* ── PRO: Detailed Analysis ── */}
          <View style={styles.proSection}>
            <Text style={styles.sectionTitle}>
              {t('dashboard.detailedAnalysis')}{' '}
              <Text style={styles.currencyLabel}>({activeCurrency})</Text>
            </Text>

            {/* Row 1: Most Active Month + Top Category */}
            <View style={styles.gridRow}>
              <View style={[styles.insightCard, { marginRight: 8 }]}>
                <Ionicons color={Colors.primary} name="calendar-outline" size={20} />
                <Text style={styles.metricLabel}>{t('dashboard.mostActiveMonth', 'En Hareketli Ay')}</Text>
                <Text style={styles.metricValue}>{analytics?.mostActiveMonth || '—'}</Text>
              </View>
              <View style={[styles.insightCard, { marginLeft: 8 }]}>
                <Ionicons color={Colors.warning} name="pricetag-outline" size={20} />
                <Text style={styles.metricLabel}>{t('dashboard.topCategory', 'Popüler Kategori')}</Text>
                <Text style={styles.metricValue}>
                  {analytics?.topCategory ? t(`categories.${analytics.topCategory.category}`) : '—'}
                </Text>
              </View>
            </View>

            {/* Row 2: Top Payer (full width) */}
            {analytics?.topPayer ? (
              <View style={styles.insightCardWide}>
                <View style={styles.insightCardWideIcon}>
                  <Ionicons color={Colors.primary} name="person-outline" size={20} />
                </View>
                <View style={styles.insightCardWideContent}>
                  <Text style={styles.metricLabel}>{t('dashboard.topPayer')}</Text>
                  <Text style={styles.metricValue}>
                    {formatAmount(analytics.topPayer.total, activeCurrency)}
                    <Text style={styles.metricSub}> · {analytics.topPayer.count} {t('dashboard.expensesCount')}</Text>
                  </Text>
                  <Text style={styles.metricName}>{analytics.topPayer.displayName}</Text>
                </View>
              </View>
            ) : null}

            {/* Row 3: Settlement Summary (2 cards) */}
            {analytics?.settlementSummary ? (
              <View style={styles.gridRow}>
                <View style={[styles.insightCard, { marginRight: 8 }]}>
                  <Ionicons color={Colors.debt} name="arrow-up-outline" size={20} />
                  <Text style={styles.metricLabel}>{t('dashboard.settlementPaid')}</Text>
                  <Text style={styles.metricValue}>
                    {formatAmount(analytics.settlementSummary.paid, activeCurrency)}
                  </Text>
                </View>
                <View style={[styles.insightCard, { marginLeft: 8 }]}>
                  <Ionicons color={Colors.credit} name="arrow-down-outline" size={20} />
                  <Text style={styles.metricLabel}>{t('dashboard.settlementReceived')}</Text>
                  <Text style={styles.metricValue}>
                    {formatAmount(analytics.settlementSummary.received, activeCurrency)}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Empty state: no analytics data */}
            {!analytics?.topPayer && !analytics?.settlementSummary && (
              <View style={styles.emptyCardSmall}>
                <Text style={styles.emptySmallText}>{t('dashboard.noBalance')}</Text>
              </View>
            )}
          </View>
        </FadeInUp>
      ) : (
        <>
          <View style={styles.proSection}>
            <Text style={styles.sectionTitle}>{t('dashboard.trends')}</Text>
            <ProLockPlaceholder height={160} onUnlock={() => router.push('/paywall?context=feature')} />
          </View>
          <View style={styles.proSection}>
            <Text style={styles.sectionTitle}>{t('dashboard.detailedAnalysis')}</Text>
            <ProLockPlaceholder height={100} onUnlock={() => router.push('/paywall?context=feature')} />
          </View>
        </>
      )}

      {!hasData && (
        <View style={styles.emptyCard}>
          <Ionicons name="stats-chart-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>{t('dashboard.emptyTitle')}</Text>
          <Text style={styles.emptySub}>{t('dashboard.emptySub')}</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function ProLockPlaceholder({ height, onUnlock }: { height: number; onUnlock: () => void }) {
  return (
    <View style={[styles.lockContainer, { height }]}>
      <View style={styles.lockInner}>
        <Ionicons name="lock-closed" size={20} color={Colors.primary} />
        <TouchableOpacity style={styles.lockCta} onPress={onUnlock} activeOpacity={0.7}>
          <Text style={styles.lockCtaText}>Pro'ya Geç</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Simple View-based bar chart — no native SVG dependency */
function SimpleBarChart({ data }: { data: { value: number; label: string; frontColor: string }[] }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={simpleChartStyles.container}>
      <View style={simpleChartStyles.bars}>
        {data.map((d, i) => (
          <View key={i} style={simpleChartStyles.barCol}>
            <View style={[simpleChartStyles.bar, { height: `${Math.max((d.value / maxVal) * 100, 4)}%` as any, backgroundColor: d.frontColor }]} />
            <Text style={simpleChartStyles.label}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const simpleChartStyles = StyleSheet.create({
  container: { height: 160, justifyContent: 'flex-end' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', flex: 1, paddingTop: 8 },
  barCol: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end', gap: 6 },
  bar: { width: 24, borderRadius: 4, minHeight: 4 },
  label: { fontFamily: Typography.fontBody, fontSize: 10, color: Colors.textSecondary, marginTop: 4 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  // Currency selector
  currencySelector: { marginBottom: Spacing.sm },
  currencySelectorContent: { gap: 8, paddingVertical: 4 },
  currencyChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  currencyChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  currencyChipText: { fontFamily: Typography.fontBodyBold, fontSize: 13, color: Colors.textSecondary },
  currencyChipTextActive: { color: '#FFFFFF' },
  currencyLabel: { fontFamily: Typography.fontBody, fontSize: 13, color: Colors.textTertiary },

  // Hero
  heroCard: { borderRadius: Radius.lg, padding: 20, marginBottom: Spacing.md, ...Shadows.md },
  heroLabel: { fontFamily: Typography.fontBodyBold, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1, marginBottom: 12 },
  heroRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 2, marginRight: Spacing.sm },
  heroBadgeText: { fontFamily: Typography.fontBodyBold, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  heroAmount: { flex: 1, fontFamily: Typography.fontDisplayBold, color: '#FFFFFF' },
  heroStatus: { fontFamily: Typography.fontBodyBold, fontSize: 13, marginLeft: Spacing.sm },
  heroCredit: { color: '#A7F3D0' },
  heroDebt: { color: 'rgba(255,255,255,0.5)' },
  heroEmpty: { fontFamily: Typography.fontBody, fontSize: 15, color: 'rgba(255,255,255,0.5)' },

  // Stats
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.cardPadding, alignItems: 'center', gap: 4, ...Shadows.sm },
  statValue: { fontFamily: Typography.fontDisplayBold, fontSize: 22, color: Colors.textPrimary },
  statLabel: { fontFamily: Typography.fontBody, fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  statCardWide: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.cardPadding, marginBottom: Spacing.md, ...Shadows.sm },
  statCardWideText: { flex: 1 },
  statValueSmall: { fontFamily: Typography.fontDisplayMedium, fontSize: 16, color: Colors.textPrimary },
  statLabelLeft: { fontFamily: Typography.fontBody, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  trophyIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.warning + '15', alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },

  // Sections
  proSection: { marginBottom: Spacing.md },
  sectionTitle: { fontFamily: Typography.fontDisplayMedium, fontSize: 16, color: Colors.textPrimary, marginBottom: Spacing.sm },

  // Category
  categoryList: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  categoryName: { fontFamily: Typography.fontBody, fontSize: 14, color: Colors.textPrimary },
  categoryAmount: { fontFamily: Typography.fontBodyBold, fontSize: 14, color: Colors.textPrimary },

  // Chart
  chartCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, paddingTop: 24, borderWidth: 1, borderColor: Colors.border },
  chartCurrencyLabel: { fontFamily: Typography.fontBodyBold, fontSize: 13, color: Colors.primary, marginBottom: 4 },
  chartCurrencyNote: { fontFamily: Typography.fontBody, fontSize: 10, color: Colors.textTertiary, marginTop: 8, textAlign: 'center' as const },

  // Other currency note
  otherCurrencyNote: { fontFamily: Typography.fontBody, fontSize: 11, color: Colors.textTertiary, marginTop: 6, fontStyle: 'italic' as const },

  // Insight cards
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  insightCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.cardPadding, ...Shadows.sm },
  insightCardWide: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.cardPadding, marginBottom: Spacing.sm, ...Shadows.sm },
  insightCardWideIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  insightCardWideContent: { flex: 1 },
  metricLabel: { fontFamily: Typography.fontBody, fontSize: 12, color: Colors.textTertiary, marginTop: 8 },
  metricValue: { fontFamily: Typography.fontDisplayBold, fontSize: 18, color: Colors.textPrimary, marginTop: 2 },
  metricSub: { fontFamily: Typography.fontBody, fontSize: 13, color: Colors.textSecondary },
  metricName: { fontFamily: Typography.fontBodyBold, fontSize: 14, color: Colors.textPrimary, marginTop: 2 },

  // Lock placeholder
  lockContainer: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, opacity: 0.6 },
  lockInner: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 10 },
  lockCta: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: 6, borderRadius: Radius.full },
  lockCtaText: { fontFamily: Typography.fontBodyBold, fontSize: 12, color: '#FFFFFF' },

  // Empty
  emptyCard: { alignItems: 'center', paddingVertical: 40, gap: Spacing.sm },
  emptyTitle: { fontFamily: Typography.fontDisplayMedium, fontSize: 18, color: Colors.textPrimary },
  emptySub: { fontFamily: Typography.fontBody, fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  emptyCardSmall: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  emptySmallText: { fontFamily: Typography.fontBody, fontSize: 14, color: Colors.textTertiary },
});
