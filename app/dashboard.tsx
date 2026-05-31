import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { usePro } from '@/hooks/usePro';
import { supabase } from '@/lib/supabase/client';
import { computeBalances, groupByCurrency } from '@/lib/finance';
import { fromMinor } from '@/lib/finance/money';
import { palette, spacing, fontSizes, radii, minTouchTarget } from '@/constants/theme';
import type { ExpenseForBalance, SplitForBalance, SettlementForBalance } from '@/lib/finance';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { isUserPro } = usePro();

  // Get all group IDs the user is a member of
  const { data: memberGroupIds, isLoading: groupsLoading } = useQuery({
    queryKey: ['dashboard-member-group-ids'],
    queryFn: async () => {
      const { data } = await supabase
        .from('group_members')
        .select('group_id, group:groups!inner(id, name)')
        .eq('user_id', user?.id ?? '')
        .eq('is_active', true);
      return (data ?? []) as unknown as { group_id: string; group: { id: string; name: string } }[];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const memberRows = memberGroupIds ?? [];
  const groupIds = memberRows.map((m) => m.group_id);

  // Get overall balance data
  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ['dashboard-balance', groupIds],
    queryFn: async () => {
      if (groupIds.length === 0) return { byCurrency: [] as { currency: string; netMinor: number; formatted: string }[], groupNames: new Map<string, string>() };

      const [{ data: expenses }, { data: allSplits }, { data: settlements }] = await Promise.all([
        supabase.from('expenses').select('id, paid_by, amount, currency, deleted_at').in('group_id', groupIds).is('deleted_at', null),
        (async () => {
          const { data: expIds } = await supabase.from('expenses').select('id').in('group_id', groupIds).is('deleted_at', null);
          const ids = (expIds ?? []).map((e: { id: string }) => e.id);
          if (ids.length === 0) return { data: [] };
          return supabase.from('expense_splits').select('expense_id, member_id, share_amount').in('expense_id', ids);
        })(),
        supabase.from('settlements').select('from_member, to_member, amount, currency, status').in('group_id', groupIds).eq('status', 'confirmed'),
      ]);

      // Get my member IDs
      const { data: myMembers } = await supabase
        .from('group_members')
        .select('id')
        .eq('user_id', user?.id ?? '')
        .eq('is_active', true);
      const myMemberIds = new Set((myMembers ?? []).map((m: { id: string }) => m.id));

      const balances = computeBalances(
        (expenses ?? []) as unknown as ExpenseForBalance[],
        (allSplits ?? []) as unknown as SplitForBalance[],
        (settlements ?? []) as unknown as SettlementForBalance[],
      );

      const myBalances = balances.filter((b) => myMemberIds.has(b.memberId));
      const grouped = groupByCurrency(myBalances);

      const groupNameMap = new Map<string, string>();
      for (const m of memberRows) {
        groupNameMap.set(m.group_id, m.group?.name ?? '');
      }

      const byCurrency = [...grouped.entries()].map(([currency, currencyBalances]) => {
        const totalMinor = currencyBalances.reduce((sum, b) => sum + b.netMinor, 0);
        const amount = fromMinor(Math.abs(totalMinor), currency);
        const formatted = new Intl.NumberFormat('tr-TR', {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
        }).format(amount);
        return { currency, netMinor: totalMinor, formatted };
      }).filter((b) => b.netMinor !== 0);

      return { byCurrency, groupNames: groupNameMap };
    },
    enabled: groupIds.length > 0,
    staleTime: 30_000,
  });

  // Get category breakdown across all groups
  const { data: categoryBreakdown } = useQuery({
    queryKey: ['dashboard-categories', groupIds],
    queryFn: async () => {
      if (groupIds.length === 0) return [];
      const { data: myMembers } = await supabase
        .from('group_members')
        .select('id')
        .eq('user_id', user?.id ?? '')
        .eq('is_active', true);
      const myMemberIds = new Set((myMembers ?? []).map((m: { id: string }) => m.id));

      const { data: mySplits } = await supabase
        .from('expense_splits')
        .select('expense_id, share_amount')
        .in('member_id', [...myMemberIds]);

      if (!mySplits?.length) return [];

      const splitMap = new Map<string, number>();
      for (const s of (mySplits ?? [])) {
        splitMap.set(s.expense_id, (splitMap.get(s.expense_id) ?? 0) + s.share_amount);
      }

      const { data: expenses } = await supabase
        .from('expenses')
        .select('id, category, currency, amount')
        .in('id', [...splitMap.keys()])
        .is('deleted_at', null);

      // Aggregate by category
      const catMap = new Map<string, { total: number; currency: string }>();
      for (const exp of (expenses ?? [])) {
        const splitShare = splitMap.get(exp.id) ?? 0;
        const shareRatio = exp.amount > 0 ? splitShare / exp.amount : 0;
        const myShare = exp.amount * shareRatio;
        const existing = catMap.get(exp.category);
        if (existing) {
          existing.total += myShare;
        } else {
          catMap.set(exp.category, { total: myShare, currency: exp.currency });
        }
      }

      return [...catMap.entries()]
        .map(([cat, { total, currency }]) => ({
          category: cat,
          amount: total,
          currency,
          formatted: new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
          }).format(total),
        }))
        .sort((a, b) => b.amount - a.amount);
    },
    enabled: groupIds.length > 0,
    staleTime: 30_000,
  });

  // If not User Pro, show locked screen
  if (!isUserPro) {
    return (
      <View style={styles.lockedContainer}>
        <Ionicons name="lock-closed" size={64} color={palette.muted} />
        <Text style={styles.lockedTitle}>{t('dashboard.lockedTitle')}</Text>
        <Text style={styles.lockedMessage}>{t('dashboard.lockedMessage')}</Text>
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={() => router.push('/paywall?context=limit')}
          activeOpacity={0.7}
        >
          <Text style={styles.upgradeButtonText}>{t('pro.upgrade')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (groupsLoading || balanceLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  const byCurrency = balanceData?.byCurrency ?? [];
  const categories = categoryBreakdown ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Overall Balance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('dashboard.overallBalance')}</Text>
        <Text style={styles.sectionSubtitle}>{t('dashboard.totalAcrossGroups')}</Text>

        {byCurrency.length === 0 ? (
          <Text style={styles.emptyText}>{t('balance.overallEmpty')}</Text>
        ) : (
          <View style={styles.balanceCards}>
            {byCurrency.map((b) => {
              const isPositive = b.netMinor > 0;
              return (
                <View key={b.currency} style={styles.balanceCard}>
                  <Text style={styles.balanceCardCurrency}>{b.currency}</Text>
                  <Text
                    style={[
                      styles.balanceCardAmount,
                      { color: isPositive ? palette.success : palette.danger },
                    ]}
                  >
                    {isPositive ? '+' : '−'}{b.formatted}
                  </Text>
                  <Text style={styles.balanceCardLabel}>
                    {isPositive ? t('dashboard.alacak') : t('dashboard.borc')}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Category Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('dashboard.categoryBreakdown')}</Text>
        {categories.length === 0 ? (
          <Text style={styles.emptyText}>{t('dashboard.comingSoon')}</Text>
        ) : (
          <View style={styles.categoryList}>
            {categories.map((c) => (
              <View key={c.category} style={styles.categoryRow}>
                <View style={styles.categoryLeft}>
                  <View style={styles.categoryDot} />
                  <Text style={styles.categoryName}>
                    {t(`categories.${c.category}`, c.category)}
                  </Text>
                </View>
                <Text style={styles.categoryAmount}>{c.formatted}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Trends — placeholder */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('dashboard.trends')}</Text>
        <View style={styles.comingSoonCard}>
          <Ionicons name="stats-chart-outline" size={32} color={palette.muted} />
          <Text style={styles.comingSoonText}>{t('dashboard.comingSoon')}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  section: { marginBottom: spacing.xl },
  sectionTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: palette.text, marginBottom: spacing.xs },
  sectionSubtitle: { fontSize: fontSizes.sm, color: palette.textSecondary, marginBottom: spacing.md },

  // Locked
  lockedContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.background, padding: spacing.xxl,
  },
  lockedTitle: { fontSize: fontSizes.xl, fontWeight: '700', color: palette.text, marginTop: spacing.md },
  lockedMessage: { fontSize: fontSizes.md, color: palette.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
  upgradeButton: {
    marginTop: spacing.lg,
    backgroundColor: palette.primary,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  upgradeButtonText: { fontSize: fontSizes.md, fontWeight: '600', color: 'white' },

  // Balance cards
  balanceCards: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  balanceCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  balanceCardCurrency: { fontSize: fontSizes.sm, fontWeight: '600', color: palette.textSecondary },
  balanceCardAmount: { fontSize: fontSizes.xxl, fontWeight: '700', marginTop: spacing.xs },
  balanceCardLabel: { fontSize: fontSizes.xs, color: palette.textSecondary, marginTop: 4 },

  // Category breakdown
  categoryList: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  categoryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: palette.border,
  },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  categoryDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: palette.primary,
  },
  categoryName: { fontSize: fontSizes.md, color: palette.text },
  categoryAmount: { fontSize: fontSizes.md, fontWeight: '600', color: palette.text },

  // Coming soon
  comingSoonCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    gap: spacing.sm,
  },
  comingSoonText: { fontSize: fontSizes.sm, color: palette.muted },

  emptyText: { fontSize: fontSizes.sm, color: palette.muted },
});
