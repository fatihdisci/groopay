import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '@/lib/auth';
import { usePro } from '@/hooks/usePro';
import { supabase } from '@/lib/supabase/client';
import { computeBalances, groupByCurrency } from '@/lib/finance';
import { fromMinor, getDecimals } from '@/lib/finance/money';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/finance/categories';
import type { Category } from '@/lib/finance/categories';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { palette, spacing, fontSizes, radii } from '@/constants/theme';
import type { ExpenseForBalance, SplitForBalance, SettlementForBalance } from '@/lib/finance';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { isUserPro } = usePro();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-tab', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: members } = await supabase
        .from('group_members')
        .select('id, group_id')
        .eq('user_id', user.id)
        .eq('is_active', true);
      const memberRows = (members ?? []) as { id: string; group_id: string }[];
      const myMemberIds = new Set(memberRows.map((m) => m.id));
      const groupIds = [...new Set(memberRows.map((m) => m.group_id))];

      if (groupIds.length === 0) return { balances: [], groupCount: 0, expenseCount: 0, topGroup: null, categories: [] };

      const { data: groups } = await supabase.from('groups').select('id, name').in('id', groupIds);

      const [{ data: expenses }, { data: allSplits }, { data: settlements }] = await Promise.all([
        supabase.from('expenses').select('id, paid_by, amount, currency, category, group_id, deleted_at').in('group_id', groupIds).is('deleted_at', null),
        (async () => {
          const { data: expIds } = await supabase.from('expenses').select('id').in('group_id', groupIds).is('deleted_at', null);
          const ids = (expIds ?? []).map((e: any) => e.id);
          if (ids.length === 0) return { data: [] };
          return supabase.from('expense_splits').select('expense_id, member_id, share_amount').in('expense_id', ids);
        })(),
        supabase.from('settlements').select('from_member, to_member, amount, currency, status').in('group_id', groupIds).eq('status', 'confirmed'),
      ]);

      // Balance per currency
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
        const formatted = new Intl.NumberFormat('tr-TR', {
          style: 'currency', currency, minimumFractionDigits: 2,
        }).format(amt);
        return { currency, netMinor: totalMinor, formatted };
      }).filter(Boolean) as { currency: string; netMinor: number; formatted: string }[];

      const expRows = (expenses ?? []) as any[];
      const groupCount = (groups ?? []).length;
      const expenseCount = expRows.length;

      // Most active group
      const groupExpCounts = new Map<string, number>();
      for (const e of expRows) groupExpCounts.set(e.group_id, (groupExpCounts.get(e.group_id) ?? 0) + 1);
      let topGroup: { name: string; count: number } | null = null;
      for (const [gid, count] of groupExpCounts) {
        if (!topGroup || count > topGroup.count) {
          topGroup = { name: (groups ?? []).find((g: any) => g.id === gid)?.name ?? '?', count };
        }
      }

      // Category breakdown
      const categorySplits = new Map<string, number>();
      for (const s of (allSplits ?? []) as any[]) {
        if (!myMemberIds.has(s.member_id)) continue;
        categorySplits.set(s.expense_id, (categorySplits.get(s.expense_id) ?? 0) + s.share_amount);
      }
      const catMap = new Map<string, { total: number; currency: string }>();
      for (const e of expRows) {
        const splitShare = categorySplits.get(e.id) ?? 0;
        const shareRatio = Number(e.amount) > 0 ? splitShare / Number(e.amount) : 0;
        const myShare = Number(e.amount) * shareRatio;
        const existing = catMap.get(e.category);
        if (existing) { existing.total += myShare; }
        else { catMap.set(e.category, { total: myShare, currency: e.currency }); }
      }
      const categories = [...catMap.entries()]
        .map(([cat, { total, currency }]) => ({
          category: cat,
          amount: total,
          currency,
          formatted: new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(total),
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      return { balances: balanceResult, groupCount, expenseCount, topGroup, categories };
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  const { balances, groupCount, expenseCount, topGroup, categories } = data;
  const hasData = balances.length > 0 || groupCount > 0;
  const heroAmountSize = balances.length >= 3 ? 28 : balances.length >= 2 ? 34 : 40;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── HERO: Overall Balance (FREE) ── */}
      <LinearGradient
        colors={[Colors.gradientStart, Colors.gradientEnd]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroLabel}>{t('dashboard.overallBalance')}</Text>
        {balances.length === 0 ? (
          <Text style={styles.heroEmpty}>{t('dashboard.noBalance')}</Text>
        ) : (
          balances.map((b) => {
            const isPositive = b.netMinor > 0;
            return (
              <View key={b.currency} style={styles.heroRow}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{b.currency}</Text>
                </View>
                <Text style={[styles.heroAmount, { fontSize: heroAmountSize }]} numberOfLines={1} adjustsFontSizeToFit>
                  {b.formatted}
                </Text>
                <Text style={[styles.heroStatus, isPositive ? styles.heroCredit : styles.heroDebt]}>
                  {isPositive ? t('dashboard.alacak') : t('dashboard.borc')}
                </Text>
              </View>
            );
          })
        )}
      </LinearGradient>

      {/* ── Basic Stats (FREE) ── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="people" size={20} color={Colors.primary} />
          <Text style={styles.statValue}>{groupCount}</Text>
          <Text style={styles.statLabel}>{t('dashboard.totalGroups')}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="receipt" size={20} color={Colors.primary} />
          <Text style={styles.statValue}>{expenseCount}</Text>
          <Text style={styles.statLabel}>{t('dashboard.totalExpenses')}</Text>
        </View>
      </View>

      {topGroup && (
        <View style={styles.statCardWide}>
          <Ionicons name="trophy-outline" size={18} color={Colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statValueSmall}>{topGroup.name}</Text>
            <Text style={styles.statLabel}>{t('dashboard.mostActiveGroup')} ({topGroup.count} {t('dashboard.expensesCount')})</Text>
          </View>
        </View>
      )}

      {/* ── Category Breakdown (FREE — always visible) ── */}
      <View style={styles.proSection}>
        <Text style={styles.sectionTitle}>{t('dashboard.categoryBreakdown')}</Text>
        {categories.length > 0 ? (
          <View style={styles.categoryList}>
            {categories.map((c) => {
              const catColor = CATEGORY_COLORS[c.category as Category] ?? Colors.primary;
              return (
                <View key={c.category} style={styles.categoryRow}>
                  <View style={styles.categoryLeft}>
                    <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
                    <Text style={styles.categoryName}>{t(`categories.${c.category}`, c.category)}</Text>
                  </View>
                  <Text style={styles.categoryAmount}>{c.formatted}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCardSmall}>
            <Text style={styles.emptySmallText}>{t('dashboard.noBalance')}</Text>
          </View>
        )}
      </View>

      {/* ── Spending Trend (BLUR for free, HIDDEN for Pro) ── */}
      {!isUserPro && (
        <View style={styles.proSection}>
          <Text style={styles.sectionTitle}>{t('dashboard.trends')}</Text>
          <ProBlurGate onUnlock={() => router.push('/paywall?context=feature')} height={140}>
            <View style={styles.trendPlaceholder}>
              <View style={styles.fakeChart}>
                {[60, 45, 70, 55, 80, 65, 90].map((h, i) => (
                  <View key={i} style={[styles.fakeBar, { height: h, backgroundColor: Colors.primary + (i % 2 === 0 ? '60' : '40') }]} />
                ))}
              </View>
            </View>
          </ProBlurGate>
        </View>
      )}

      {/* ── Detailed Group Analysis (BLUR for free, HIDDEN for Pro) ── */}
      {!isUserPro && (
        <View style={styles.proSection}>
          <Text style={styles.sectionTitle}>{t('dashboard.detailedAnalysis')}</Text>
          <ProBlurGate onUnlock={() => router.push('/paywall?context=feature')} height={120}>
            <View style={styles.analysisPlaceholder}>
              <View style={styles.fakeRow} />
              <View style={[styles.fakeRow, { width: '75%' }]} />
              <View style={[styles.fakeRow, { width: '60%' }]} />
              <View style={[styles.fakeRow, { width: '85%' }]} />
            </View>
          </ProBlurGate>
        </View>
      )}

      {/* ── Empty state ── */}
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

/** Blur overlay with lock + CTA for non-Pro users */
function ProBlurGate({ children, onUnlock, height }: { children: React.ReactNode; onUnlock: () => void; height: number }) {
  return (
    <View style={{ height, overflow: 'hidden', borderRadius: Radius.lg }}>
      <View style={{ opacity: 0.4 }}>
        {children}
      </View>
      <BlurView intensity={12} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.lockOverlay}>
        <Ionicons name="lock-closed" size={20} color={Colors.primary} />
        <TouchableOpacity style={styles.lockCta} onPress={onUnlock} activeOpacity={0.7}>
          <Text style={styles.lockCtaText}>{'Pro\'ya Geç'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },

  // Hero
  heroCard: { borderRadius: Radius.lg, padding: 20, marginBottom: Spacing.md, ...Shadows.md },
  heroLabel: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.55)', letterSpacing: 1, marginBottom: 12 },
  heroRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: Radius.sm,
    paddingHorizontal: 8, paddingVertical: 2, marginRight: Spacing.sm,
  },
  heroBadgeText: { fontFamily: Typography.fontBodyBold, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  heroAmount: { flex: 1, fontFamily: Typography.fontDisplayBold, color: '#FFFFFF' },
  heroStatus: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.sm, marginLeft: Spacing.sm },
  heroCredit: { color: '#A7F3D0' },
  heroDebt: { color: 'rgba(255,255,255,0.5)' },
  heroEmpty: { fontFamily: Typography.fontBody, fontSize: Typography.size.md, color: 'rgba(255,255,255,0.5)' },

  // Stats
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.cardPadding, alignItems: 'center', gap: 4, ...Shadows.sm,
  },
  statValue: { fontFamily: Typography.fontDisplayBold, fontSize: Typography.size.xl, color: Colors.textPrimary },
  statLabel: { fontFamily: Typography.fontBody, fontSize: Typography.size.xs, color: Colors.textSecondary, textAlign: 'center' },
  statCardWide: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.cardPadding, marginBottom: Spacing.md, ...Shadows.sm,
  },
  statValueSmall: { fontFamily: Typography.fontDisplayMedium, fontSize: Typography.size.md, color: Colors.textPrimary },

  // Sections
  proSection: { marginBottom: Spacing.md },
  sectionTitle: { fontFamily: Typography.fontDisplayMedium, fontSize: Typography.size.md, color: Colors.textPrimary, marginBottom: Spacing.sm },

  // Category list
  categoryList: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  categoryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  categoryName: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: Colors.textPrimary },
  categoryAmount: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.sm, color: Colors.textPrimary },

  // Empty (small)
  emptyCardSmall: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  emptySmallText: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: Colors.textTertiary },

  // Blur gate
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, zIndex: 10,
  },
  lockCta: {
    marginTop: 4, backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg, paddingVertical: 6,
    borderRadius: Radius.full,
  },
  lockCtaText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs, color: '#FFFFFF' },

  // Trend placeholder (blurred)
  trendPlaceholder: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, height: 140,
    borderWidth: 1, borderColor: Colors.border,
  },
  fakeChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', flex: 1, gap: 8 },
  fakeBar: { width: 28, borderRadius: 4 },

  // Analysis placeholder (blurred)
  analysisPlaceholder: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, height: 120, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, justifyContent: 'center',
  },
  fakeRow: { height: 12, backgroundColor: Colors.primary + '30', borderRadius: 6, width: '100%' },

  // Empty
  emptyCard: { alignItems: 'center', paddingVertical: 40, gap: Spacing.sm },
  emptyTitle: { fontFamily: Typography.fontDisplayMedium, fontSize: Typography.size.lg, color: Colors.textPrimary },
  emptySub: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: Colors.textSecondary, textAlign: 'center' },
});
