import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Share, TextInput, Modal, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { useExpenses, useDeleteExpense, canModifyExpense, getActorMember } from '@/hooks/useExpenses';
import { useRealtime } from '@/hooks/useRealtime';
import { useBalance } from '@/hooks/useBalance';
import type { BalanceByCurrency } from '@/hooks/useBalance';
import { useFxRate } from '@/hooks/useFxRate';
import { useGroupSettlements, useAddSettlement, useConfirmSettlement, useRejectSettlement } from '@/hooks/useSettlements';
import { fromMinor, formatAmount } from '@/lib/finance';
import type { MemberBalance, SimplifiedTx, SettlementForBalance } from '@/lib/finance';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { palette, spacing, fontSizes, radii } from '@/constants/theme';
import { CATEGORY_ICONS, CATEGORY_COLORS, CATEGORIES } from '@/lib/finance/categories';
import type { Category } from '@/lib/finance/categories';
import type { GroupMemberRow, ExpenseWithSplits, ExpenseRow, ExpenseSplitRow, ActivityLogRow, SettlementRow } from '@/lib/supabase/types';
import { getGroupActivity, generateWhatsAppSummary, requestIban, getPendingIbanRequests, fulfillIbanRequest } from '@/lib/supabase/queries';
import { supabase } from '@/lib/supabase/client';
import Avatar from '@/components/Avatar';
import TipsButton from '@/components/TipsButton';

// ── Helpers ──

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toLocaleUpperCase('tr-TR');
  return (parts[0]?.[0] ?? '?').toLocaleUpperCase('tr-TR');
}

function timeAgo(dateStr: string, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('activity.justNow');
  if (mins < 60) return t('activity.minutesAgo', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('activity.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('activity.daysAgo', { n: days });
  return new Date(dateStr).toLocaleDateString('tr-TR');
}

// ── Main screen ──

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { data, isLoading } = useGroupDetail(id!);
  const insets = useSafeAreaInsets();

  // Hide Stack header — nav buttons are embedded in gradient hero
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [filterCategory, setFilterCategory] = useState<Category | null>(null);
  const [showFx, setShowFx] = useState(false);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances'>('expenses');
  const [balanceMode, setBalanceMode] = useState<'simplified' | 'raw'>('simplified');
  const fabAnim = useRef(new Animated.Value(1)).current;
  const fabScale = useRef(new Animated.Value(1)).current;

  // Animate FAB when tab changes
  useEffect(() => {
    if (activeTab === 'expenses') {
      Animated.parallel([
        Animated.spring(fabAnim, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
        Animated.spring(fabScale, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fabAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(fabScale, { toValue: 0.5, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [activeTab, fabAnim, fabScale]);

  const filters = useMemo(() => {
    if (!filterCategory) return undefined;
    return { category: filterCategory };
  }, [filterCategory]);

  const { data: expensesData } = useExpenses(id!, filters);
  const deleteExpenseMutation = useDeleteExpense();

  // Realtime — live updates
  useRealtime(id!);

  // Activity
  const { data: activityData } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => getGroupActivity(id!, 10),
    enabled: !!id,
    staleTime: 10_000,
  });

  const groupCurrency = data?.group.base_currency ?? 'TRY';

  // ⚠️ ALL hooks must be called BEFORE any conditional return (Rules of Hooks)
  const expenses: ExpenseWithSplits[] = expensesData ?? [];
  const allSplits: ExpenseSplitRow[] = useMemo(() => {
    const s: ExpenseSplitRow[] = [];
    for (const ew of expenses) for (const sp of ew.splits) s.push(sp);
    return s;
  }, [expenses]);
  const allExpenses = useMemo(() => expenses.map((e) => e.expense) as ExpenseRow[], [expenses]);
  const { data: settlementsData } = useGroupSettlements(id!);
  const settlements = settlementsData ?? [];
  const settlementInputs: SettlementForBalance[] = useMemo(
    () => settlements.map((s: SettlementRow) => ({
      from_member: s.from_member, to_member: s.to_member,
      amount: s.amount, currency: s.currency, status: s.status,
    })),
    [settlements],
  );
  const balanceByCurrency = useBalance(allExpenses, allSplits, settlementInputs);
  const addSettlementMut = useAddSettlement();
  const confirmSettlementMut = useConfirmSettlement();
  const rejectSettlementMut = useRejectSettlement();
  const [settleModalVisible, setSettleModalVisible] = useState(false);
  const [settleTarget, setSettleTarget] = useState<{ to: string; toName: string; currency: string; maxMinor: number } | null>(null);
  const [settleAmountStr, setSettleAmountStr] = useState('');
  const [ibanModalVisible, setIbanModalVisible] = useState(false);
  const [ibanTargetMember, setIbanTargetMember] = useState<GroupMemberRow | null>(null);
  const [ibanModalMode, setIbanModalMode] = useState<'request' | 'enter' | 'received'>('request');
  const [ibanInputText, setIbanInputText] = useState('');
  const [ibanReceivedText, setIbanReceivedText] = useState<string | null>(null);
  const [ibanActiveRequestId, setIbanActiveRequestId] = useState<string | null>(null);
  const ibanChannelsRef = useRef<Map<string, any>>(new Map());

  // ── IBAN pending requests (for creditor) ──
  const { data: ibanRequestsData } = useQuery({
    queryKey: ['iban_requests', id],
    queryFn: () => getPendingIbanRequests(id!),
    enabled: !!id,
    staleTime: 3_000,
  });
  const pendingIbanReqs = useMemo(
    () => (ibanRequestsData ?? []).filter((r: { status: string }) => r.status === 'pending'),
    [ibanRequestsData],
  );

  // ── IBAN realtime: listen for incoming IBAN broadcasts (debtor side) ──
  useEffect(() => {
    if (!pendingIbanReqs.length || !user?.id) return;
    // Find actorMember from the latest data (may not be loaded yet on first render)
    if (!data) return;
    const actor = getActorMember(data.members as GroupMemberRow[], user.id);
    if (!actor) return;

    const channelsToClean: any[] = [];

    for (const req of pendingIbanReqs) {
      if (req.from_member !== actor.id) continue;
      if (ibanChannelsRef.current.has(req.id)) continue;

      const channelName = `iban-${req.id}`;
      const channel = supabase.channel(channelName);
      channel.on('broadcast', { event: 'iban_shared' }, (payload: any) => {
        setIbanReceivedText(payload.payload?.iban ?? '');
        setIbanActiveRequestId(req.id);
        setIbanModalMode('received');
        setIbanModalVisible(true);
      }).subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('[iban] Listening on', channelName);
        }
      });

      ibanChannelsRef.current.set(req.id, channel);
      channelsToClean.push(channel);
    }

    return () => {
      for (const ch of channelsToClean) {
        supabase.removeChannel(ch);
      }
    };
  }, [pendingIbanReqs.length, user?.id, data]);

  const handleShareWhatsApp = async () => {
    const enriched = new Map<string, any>();
    for (const [cur, data] of balanceByCurrency) {
      enriched.set(cur, { currency: cur, simplified: data.simplified.map((tx) => ({
        ...tx, fromName: (members as GroupMemberRow[]).find((m) => m.id === tx.from)?.display_name,
        toName: (members as GroupMemberRow[]).find((m) => m.id === tx.to)?.display_name,
      })) });
    }
    try { await Share.share({ message: generateWhatsAppSummary(group.name, enriched) }); } catch { /* cancelled */ }
  };

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={palette.primary} /></View>;
  }
  if (!data) {
    return <View style={styles.centered}><Text style={styles.emptyText}>Grup bulunamadı</Text></View>;
  }

  const { group, members } = data;
  const actorMember = getActorMember(members as GroupMemberRow[], user?.id);
  const isFounder = actorMember?.role === 'founder';

  // ── IBAN handlers ──
  const handleIbanRequest = (to: GroupMemberRow, _currency: string) => {
    setIbanTargetMember(to);
    setIbanModalMode('request');
    setIbanModalVisible(true);
  };

  const handleIbanRequestConfirm = async () => {
    if (!ibanTargetMember || !actorMember) return;
    try {
      const reqId = await requestIban(id!, actorMember.id, ibanTargetMember.id);
      // Subscribe to broadcast channel for this request (debtor side)
      const channelName = `iban-${reqId}`;
      const channel = supabase.channel(channelName);
      channel.on('broadcast', { event: 'iban_shared' }, (payload: any) => {
        setIbanReceivedText(payload.payload?.iban ?? '');
        setIbanActiveRequestId(reqId);
        setIbanModalMode('received');
        setIbanModalVisible(true);
      }).subscribe();

      ibanChannelsRef.current.set(reqId, channel);
      setIbanModalVisible(false);
      Alert.alert('', t('iban.requestSent'));
    } catch (e: any) {
      Alert.alert(t('settle.errorTitle'), e?.message ?? t('settle.unknownError'));
    }
  };

  const handleIbanEnter = (req: { id: string; from_member: string }) => {
    const fromM = (members as GroupMemberRow[]).find((m) => m.id === req.from_member);
    setIbanTargetMember(fromM ?? null);
    setIbanActiveRequestId(req.id);
    setIbanInputText('');
    setIbanModalMode('enter');
    setIbanModalVisible(true);
  };

  const handleIbanShare = async () => {
    if (!ibanInputText.trim() || !ibanActiveRequestId) return;
    const channelName = `iban-${ibanActiveRequestId}`;
    const channel = supabase.channel(channelName);
    channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({
          type: 'broadcast',
          event: 'iban_shared',
          payload: { iban: ibanInputText.trim() },
        });
        // Mark request as fulfilled
        await fulfillIbanRequest(ibanActiveRequestId);
        supabase.removeChannel(channel);
        setIbanModalVisible(false);
        setIbanInputText('');
        Alert.alert('', t('iban.shared'));
      }
    });
  };

  const handleRemind = async (to: GroupMemberRow, currency: string, amountMinor: number) => {
    const amt = formatAmount(fromMinor(amountMinor, currency), currency);
    const msg = t('iban.remindMessage', {
      group: group.name,
      to: to.display_name,
      amt,
    });
    try { await Share.share({ message: msg }); } catch { /* cancelled */ }
  };

  const handleDelete = (expenseId: string) => {
    if (!actorMember) { Alert.alert(t('settle.errorTitle'), t('settle.memberNotFound')); return; }
    Alert.alert('', t('expense.deleteConfirm'), [
      { text: t('groups.cancel'), style: 'cancel' },
      { text: t('expense.delete'), style: 'destructive',
        onPress: () => deleteExpenseMutation.mutate({ expenseId, actorMemberId: actorMember.id }) },
    ]);
  };

  const hasBalances = balanceByCurrency.size > 0;

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Group header — gradient with embedded nav buttons */}
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          {/* Top bar: back (left) · edit + tips (right), safe area aware */}
          <View style={[styles.headerTopBar, { paddingTop: 4 }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.headerNavButton}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Spacer — group name is centered below, buttons on sides */}
            <View style={{ flex: 1 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {isFounder && (
                <TouchableOpacity
                  onPress={() => router.push(`/groups/${id}/edit`)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.headerNavButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.edit')}
                >
                  <Ionicons name="create-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              <TipsButton
                color="#FFFFFF"
                title={t('tips.groupDetail.title')}
                tips={[
                  { icon: 'receipt-outline' as const, text: t('tips.groupDetail.tip1') },
                  { icon: 'swap-horizontal-outline' as const, text: t('tips.groupDetail.tip2') },
                  { icon: 'git-compare-outline' as const, text: t('tips.groupDetail.tip3') },
                  { icon: 'document-text-outline' as const, text: t('tips.groupDetail.tip4') },
                ]}
              />
            </View>
          </View>

          <Avatar
            initials={getInitials(group.name)}
            color={group.avatar_color}
            emoji={group.avatar_emoji}
            size={64}
          />
          <Text style={styles.groupName}>{group.name}</Text>
          {group.description ? (
            <Text style={styles.groupDescription}>{group.description}</Text>
          ) : null}
          <Text style={styles.groupMeta}>{members.filter((m: GroupMemberRow) => m.is_active).length} {t('groups.members')}</Text>
          {group.is_demo && (
            <View style={styles.demoBadge}><Text style={styles.demoBadgeText}>{t('groups.demoBadge')}</Text></View>
          )}
        </LinearGradient>

        {/* Quick member chips */}
        <Text style={styles.sectionTitle}>{t('groupDetail.members').toLocaleUpperCase('tr-TR')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberScroll}>
          {members.filter((m: GroupMemberRow) => m.is_active).map((m: GroupMemberRow) => {
            const profileColor = m.user_id ? data.memberAvatarColors?.[m.user_id] : null;
            return (
              <View key={m.id} style={styles.memberChip}>
                <Avatar
                  initials={getInitials(m.display_name)}
                  color={profileColor ?? undefined}
                  ghostColor={!m.user_id ? palette.muted : undefined}
                  size={44}
                />
                <Text style={styles.memberName}>{m.display_name}</Text>
                {!m.user_id && <Ionicons name="person-add-outline" size={12} color={palette.muted} />}
              </View>
            );
          })}
          <TouchableOpacity
            style={styles.memberChip}
            onPress={() => router.push(`/groups/${id}/members`)}
            accessibilityRole="button"
            accessibilityLabel={t('members.title')}
          >
            <View style={[styles.memberAvatar, styles.addAvatar]}>
              <Ionicons name="person-add-outline" size={20} color={palette.primary} />
            </View>
            <Text style={styles.memberName}>{t('groupDetail.addMember')}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ── Tab bar: Expenses | Balances ── */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'expenses' && styles.tabActive]}
            onPress={() => setActiveTab('expenses')}
            accessibilityRole="button"
            accessibilityLabel={t('groupDetail.expensesTab')}
            accessibilityState={{ selected: activeTab === 'expenses' }}
          >
            <Ionicons name="receipt-outline" size={16} color={activeTab === 'expenses' ? palette.primary : palette.muted} />
            <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>{t('groupDetail.expenses')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'balances' && styles.tabActive]}
            onPress={() => setActiveTab('balances')}
            accessibilityRole="button"
            accessibilityLabel={t('groupDetail.balancesTab')}
            accessibilityState={{ selected: activeTab === 'balances' }}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color={activeTab === 'balances' ? palette.primary : palette.muted} />
            <Text style={[styles.tabText, activeTab === 'balances' && styles.tabTextActive]}>{t('groupDetail.balances')}</Text>
            {hasBalances && <View style={styles.tabBadge} />}
          </TouchableOpacity>
        </View>

        {/* ── TAB: Expenses ── */}
        {activeTab === 'expenses' && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              <TouchableOpacity style={[styles.filterChip, !filterCategory && styles.filterChipActive]} onPress={() => setFilterCategory(null)}>
                <Text style={[styles.filterChipText, !filterCategory && styles.filterChipTextActive]}>{t('expense.allCategories')}</Text>
              </TouchableOpacity>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity key={cat} style={[styles.filterChip, filterCategory === cat && { backgroundColor: CATEGORY_COLORS[cat] + '20', borderColor: CATEGORY_COLORS[cat] }]} onPress={() => setFilterCategory(filterCategory === cat ? null : cat)}>
                  <Ionicons name={CATEGORY_ICONS[cat] as any} size={14} color={filterCategory === cat ? CATEGORY_COLORS[cat] : palette.muted} />
                  <Text style={[styles.filterChipText, filterCategory === cat && { color: CATEGORY_COLORS[cat] }]}>{t(`categories.${cat}`)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.fxToggle}
              onPress={() => setShowFx(!showFx)}
              accessibilityRole="button"
              accessibilityLabel={t('expense.fxToggle')}
            >
              <Ionicons name="swap-horizontal-outline" size={14} color={palette.primary} />
              <Text style={styles.fxToggleText}>{showFx ? t('expense.hideTryEquivalent') : t('expense.showTryEquivalent')}</Text>
            </TouchableOpacity>

            {expenses.length === 0 ? (
              <View style={styles.placeholder}>
                <Ionicons name="receipt-outline" size={40} color={palette.muted} />
                <Text style={styles.placeholderText}>{t('expense.noExpenses')}</Text>
              </View>
            ) : (
              expenses.map(({ expense, splits }) => {
                const payer = members.find((m: GroupMemberRow) => m.id === expense.paid_by);
                const cat = expense.category as Category;
                const canModify = !!(actorMember && canModifyExpense(expense as ExpenseRow, actorMember));
                return (
                  <ExpenseCard key={expense.id} expense={expense} splits={splits} members={members as GroupMemberRow[]}
                    payerName={payer?.display_name ?? '?'} category={cat} groupCurrency={groupCurrency}
                    showFx={showFx} canModify={canModify}
                    onEdit={() => router.push({ pathname: `/groups/${id}/add-expense`, params: { expenseId: expense.id } })}
                    onDelete={() => handleDelete(expense.id)} t={t} />
                );
              })
            )}
          </>
        )}

        {/* ── TAB: Balances ── */}
        {activeTab === 'balances' && (
          <>
            {!hasBalances ? (
              <View style={styles.placeholder}>
                <Ionicons name="swap-horizontal-outline" size={40} color={palette.muted} />
                <Text style={styles.placeholderText}>{t('balance.empty')}</Text>
              </View>
            ) : (
              <>
                {/* Self-summary — gradient card */}
                {actorMember && [...balanceByCurrency.entries()].some(([, v]) => v.balances.some((b) => b.memberId === actorMember.id)) && (
                  <LinearGradient
                    colors={['#6366F1', '#8B5CF6']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.selfSummary}
                  >
                    <Text style={styles.selfSummaryTitle}>{t('balance.yourStatus').toLocaleUpperCase('tr-TR')}</Text>
                    {[...balanceByCurrency.entries()].map(([cur, v]) => {
                      const self = v.balances.find((b) => b.memberId === actorMember.id);
                      if (!self) return null;
                      return (
                        <View key={cur} style={styles.selfRow}>
                          <Text style={styles.selfAmount}>
                            {formatAmount(fromMinor(Math.abs(self.netMinor), cur), cur)}
                          </Text>
                          <Text style={styles.selfStatus}>
                            {self.netMinor > 0 ? t('balance.youAreOwed') : self.netMinor < 0 ? t('balance.youOwe') : t('balance.youAreEven')}
                          </Text>
                        </View>
                      );
                    })}
                  </LinearGradient>
                )}

                {/* WhatsApp share */}
                <TouchableOpacity
                  style={styles.whatsappBtn}
                  onPress={handleShareWhatsApp}
                  accessibilityRole="button"
                  accessibilityLabel={t('balance.whatsapp')}
                >
                  <Ionicons name="share-outline" size={14} color={palette.primary} />
                  <Text style={styles.whatsappBtnText}>{t('settle.share')}</Text>
                </TouchableOpacity>

                {/* Mode toggle */}
                <View style={styles.modeToggle}>
                  <TouchableOpacity
                    style={[styles.modeBtn, balanceMode === 'simplified' && styles.modeBtnActive]}
                    onPress={() => setBalanceMode('simplified')}
                    accessibilityRole="button"
                    accessibilityLabel={t('balance.simplified')}
                    accessibilityState={{ selected: balanceMode === 'simplified' }}
                  >
                    <Text style={[styles.modeBtnText, balanceMode === 'simplified' && styles.modeBtnTextActive]}>{t('balance.simplified')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeBtn, balanceMode === 'raw' && styles.modeBtnActive]}
                    onPress={() => setBalanceMode('raw')}
                    accessibilityRole="button"
                    accessibilityLabel={t('balance.raw')}
                    accessibilityState={{ selected: balanceMode === 'raw' }}
                  >
                    <Text style={[styles.modeBtnText, balanceMode === 'raw' && styles.modeBtnTextActive]}>{t('balance.raw')}</Text>
                  </TouchableOpacity>
                </View>

                {/* Pending settlements */}
                {settlements.filter((s: SettlementRow) => s.status === 'pending').length > 0 && (
                  <View style={styles.pendingCard}>
                    <Text style={styles.pendingTitle}>{t('settle.pending').toLocaleUpperCase('tr-TR')}</Text>
                    {settlements.filter((s: SettlementRow) => s.status === 'pending').map((s: SettlementRow) => {
                      const fromM = (members as GroupMemberRow[]).find((m) => m.id === s.from_member);
                      const toM = (members as GroupMemberRow[]).find((m) => m.id === s.to_member);
                      const isCreditor = actorMember && s.to_member === actorMember.id;
                      const isDebtor = actorMember && s.from_member === actorMember.id;
                      return (
                        <View key={s.id} style={styles.pendingRow}>
                          <Text style={styles.pendingText}>
                            {isDebtor ? t('settle.youMarked', { amt: formatAmount(Number(s.amount), s.currency), to: toM?.display_name ?? '?' }) :
                             isCreditor ? t('settle.markedToYou', { from: fromM?.display_name ?? '?', amt: formatAmount(Number(s.amount), s.currency) }) :
                             t('settle.markedGeneric', { from: fromM?.display_name ?? '?', to: toM?.display_name ?? '?', amt: formatAmount(Number(s.amount), s.currency) })}
                          </Text>
                          {isCreditor && (
                            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                              <TouchableOpacity
                                style={styles.confirmBtn}
                                onPress={() => confirmSettlementMut.mutate({ settlementId: s.id, confirmedBy: actorMember.id })}
                                accessibilityRole="button"
                                accessibilityLabel={t('settle.confirm')}
                              >
                                <Text style={styles.confirmBtnText}>{t('settle.confirm')}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.rejectBtn}
                                onPress={() => rejectSettlementMut.mutate({ settlementId: s.id, confirmedBy: actorMember.id })}
                                accessibilityRole="button"
                                accessibilityLabel={t('settle.reject')}
                              >
                                <Text style={styles.rejectBtnText}>{t('settle.reject')}</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Pending IBAN requests (for creditor) */}
                {actorMember && pendingIbanReqs.filter((r: any) => r.to_member === actorMember?.id).length > 0 && (
                  <View style={styles.pendingCard}>
                    <Text style={styles.pendingTitle}>{t('iban.pendingRequests').toLocaleUpperCase('tr-TR')}</Text>
                    {pendingIbanReqs.filter((r: any) => r.to_member === actorMember?.id).map((r: any) => {
                      const fromM = (members as GroupMemberRow[]).find((m: GroupMemberRow) => m.id === r.from_member);
                      return (
                        <View key={r.id} style={styles.pendingRow}>
                          <Text style={styles.pendingText}>
                            {t('iban.requestTitle', { name: fromM?.display_name ?? '?' })}
                          </Text>
                          <TouchableOpacity
                            style={styles.confirmBtn}
                            onPress={() => handleIbanEnter(r)}
                            accessibilityRole="button"
                            accessibilityLabel={t('iban.enterIban')}
                          >
                            <Text style={styles.confirmBtnText}>{t('iban.shareIban')}</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Per-currency balance sections */}
                {[...balanceByCurrency.entries()].map(([currency, data]) => (
                  <View key={currency} style={styles.currencyBalanceCard}>
                    <Text style={styles.currencyBalanceTitle}>{currency}</Text>
                    {balanceMode === 'raw' ? (
                      <RawBalanceList balances={data.balances} members={members as GroupMemberRow[]} currency={currency} t={t} />
                    ) : (
                      <SimplifiedBalanceList txs={data.simplified} members={members as GroupMemberRow[]} currency={currency}
                        actorMember={actorMember} onSettle={(to, toName, cur, max) => { setSettleTarget({ to, toName, currency: cur, maxMinor: max }); setSettleAmountStr(''); setSettleModalVisible(true); }} onIbanRequest={handleIbanRequest} settlements={settlements} t={t} />
                    )}
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* ── Recent activity ── */}
        {activityData && activityData.length > 0 && (
          <>
            <Text style={styles.activitySectionTitle}>{t('activity.recent').toLocaleUpperCase('tr-TR')}</Text>
            {(activityData as ActivityLogRow[]).slice(0, 5).map((a) => {
              const iconName = getActivityIcon(a.action_type);
              const iconColor = getActivityColor(a.action_type);
              return (
                <View key={a.id} style={styles.activityRow}>
                  <Ionicons name={iconName} size={14} color={iconColor} style={{ marginTop: 2 }} />
                  <Text style={styles.activityText} numberOfLines={1}>
                    {formatActivity(a, members as GroupMemberRow[], t)}
                  </Text>
                  <Text style={styles.activityTime}>{timeAgo(a.created_at, t)}</Text>
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: spacing.xxl * 2 }} />
      </ScrollView>

      {/* ── Extended FAB: Add Expense ── */}
      {activeTab === 'expenses' && (
        <Animated.View
          style={[
            styles.fab,
            {
              opacity: fabAnim,
              transform: [
                { scale: fabScale },
                {
                  translateY: fabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents={activeTab === 'expenses' ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={styles.fabTouchable}
            onPress={() => router.push(`/groups/${id}/add-expense`)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('expense.addExpenseFab')}
          >
            <Ionicons name="add" size={22} color="white" />
            <Text style={styles.fabLabel}>{t('expense.addExpenseFab')}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Settlement modal ── */}
      <Modal visible={settleModalVisible} transparent animationType="fade" onRequestClose={() => setSettleModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('settle.payTitle', { to: settleTarget?.toName ?? '' })}</Text>
            <Text style={styles.modalSub}>{t('settle.paySub', { max: settleTarget ? formatAmount(fromMinor(settleTarget.maxMinor, settleTarget.currency), settleTarget.currency) : '' })}</Text>
            <TextInput style={styles.modalInput} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={palette.muted}
              value={settleAmountStr} onChangeText={setSettleAmountStr} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setSettleModalVisible(false)}>
                <Text style={styles.modalCancelText}>{t('groups.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={() => {
                if (!settleTarget || !actorMember) return;
                const amt = parseFloat(settleAmountStr.replace(',', '.'));
                if (!amt || amt <= 0) { Alert.alert('', t('settle.invalidAmount')); return; }
                const max = fromMinor(settleTarget.maxMinor, settleTarget.currency);
                if (amt > max) { Alert.alert('', t('settle.overpay', { max: formatAmount(max, settleTarget.currency) })); return; }
                addSettlementMut.mutate({ groupId: id!, fromMember: actorMember.id, toMember: settleTarget.to, amount: amt, currency: settleTarget.currency, markedBy: actorMember.id });
                setSettleModalVisible(false);
              }}>
                <Text style={styles.modalConfirmText}>{t('settle.markPaid')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── IBAN request confirmation modal (debtor) ── */}
      <Modal visible={ibanModalVisible && ibanModalMode === 'request'} transparent animationType="fade" onRequestClose={() => setIbanModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('iban.requestTitle', { name: ibanTargetMember?.display_name ?? '' })}</Text>
            <Text style={styles.modalSub}>{t('iban.requestConfirm', { name: ibanTargetMember?.display_name ?? '' })}</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setIbanModalVisible(false)}>
                <Text style={styles.modalCancelText}>{t('groups.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleIbanRequestConfirm}>
                <Text style={styles.modalConfirmText}>{t('iban.request')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── IBAN entry modal (creditor) ── */}
      <Modal visible={ibanModalVisible && ibanModalMode === 'enter'} transparent animationType="fade" onRequestClose={() => setIbanModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('iban.enterIbanTitle', { name: ibanTargetMember?.display_name ?? '' })}</Text>
            <TextInput style={styles.ibanInput} placeholder="TR00 0000 0000 0000 0000 0000 00" placeholderTextColor={palette.muted}
              value={ibanInputText} onChangeText={setIbanInputText} autoCapitalize="characters" autoCorrect={false} />
            <Text style={styles.ibanDisclaimer}>
              <Ionicons name="shield-checkmark-outline" size={12} color={palette.muted} /> {t('iban.disclaimer')}
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setIbanModalVisible(false)}>
                <Text style={styles.modalCancelText}>{t('groups.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirm, !ibanInputText.trim() && { opacity: 0.5 }]} onPress={handleIbanShare} disabled={!ibanInputText.trim()}>
                <Text style={styles.modalConfirmText}>{t('iban.shareIban')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── IBAN received modal (debtor) ── */}
      <Modal visible={ibanModalVisible && ibanModalMode === 'received'} transparent animationType="fade" onRequestClose={() => { setIbanModalVisible(false); setIbanReceivedText(null); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('iban.receivedTitle')}</Text>
            <Text style={styles.modalSub}>{t('iban.receivedFrom', { name: ibanTargetMember?.display_name ?? '' })}</Text>
            <Text selectable style={styles.ibanReceivedText}>{ibanReceivedText}</Text>
            <Text style={styles.ibanDisclaimer}>
              <Ionicons name="shield-checkmark-outline" size={12} color={palette.muted} /> {t('iban.disclaimer')}
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalConfirm, { flex: 1 }]} onPress={() => { setIbanModalVisible(false); setIbanReceivedText(null); }}>
                <Text style={styles.modalConfirmText}>{t('groups.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Balance sub-components ──

function RawBalanceList({ balances, members, currency, t }: { balances: MemberBalance[]; members: GroupMemberRow[]; currency: string; t: (k: string, opts?: any) => string }) {
  return (
    <View>
      {balances.map((b) => {
        const m = members.find((mb) => mb.id === b.memberId);
        const isPositive = b.netMinor > 0;
        const isNegative = b.netMinor < 0;
        return (
          <View key={b.memberId} style={styles.balanceRow}>
            <Avatar initials={getInitials(m?.display_name ?? '?')} size={32} />
            <Text style={styles.balanceName}>{m?.display_name ?? '?'}</Text>
            <Text style={[styles.balanceAmount, isPositive && styles.balancePositive, isNegative && styles.balanceNegative]}>
              {formatAmount(fromMinor(Math.abs(b.netMinor), currency), currency)}
            </Text>
            <Text style={[styles.balanceStatus, isPositive && styles.balancePositive, isNegative && styles.balanceNegative]}>
              {isPositive ? t('balance.youAreOwed') : isNegative ? t('balance.youOwe') : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function SimplifiedBalanceList({ txs, members, currency, actorMember, onSettle, onIbanRequest, settlements, t }: {
  txs: SimplifiedTx[]; members: GroupMemberRow[]; currency: string;
  actorMember?: GroupMemberRow;
  onSettle: (to: string, toName: string, currency: string, maxMinor: number) => void;
  onIbanRequest: (to: GroupMemberRow, currency: string) => void;
  settlements: SettlementRow[];
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  if (txs.length === 0) {
    return <Text style={styles.noDebts}>{t('balance.allSettled')}</Text>;
  }
  return (
    <View>
      {txs.map((tx, i) => {
        const fromM = members.find((m) => m.id === tx.from);
        const toM = members.find((m) => m.id === tx.to);
        const isDebtor = actorMember && tx.from === actorMember.id;
        const hasPendingSettle = isDebtor && actorMember && settlements.some(
          (s) => s.status === 'pending'
            && s.from_member === actorMember.id
            && s.to_member === tx.to
            && s.currency === currency
        );
        return (
          <View key={i} style={styles.simplifiedRow}>
            <View style={styles.simplifiedTopRow}>
              <View style={styles.simplifiedMembers}>
                <Text style={styles.simplifiedFrom}>{fromM?.display_name ?? '?'}</Text>
                <Ionicons name="arrow-forward-outline" size={14} color={palette.primary} />
                <Text style={styles.simplifiedTo}>{toM?.display_name ?? '?'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <Text style={styles.simplifiedAmount}>{formatAmount(fromMinor(tx.amountMinor, currency), currency)}</Text>
                {isDebtor && hasPendingSettle && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>{t('settle.awaitingApproval')}</Text>
                  </View>
                )}
                {isDebtor && !hasPendingSettle && (
                  <>
                    <TouchableOpacity
                      style={styles.actionIconBtnWrap}
                      onPress={() => onSettle(tx.to, toM?.display_name ?? '?', currency, tx.amountMinor)}
                      accessibilityLabel={t('settle.markPaidLabel')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="checkmark" size={16} color={Colors.credit} />
                      <Text style={styles.actionIconLabel}>{t('settle.markPaid')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionIconBtnWrap}
                      onPress={() => onIbanRequest(toM!, currency)}
                      accessibilityLabel={t('iban.requestLabel')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="card-outline" size={15} color={Colors.primary} />
                      <Text style={styles.actionIconLabelBlue}>{t('iban.request')}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Expense card ──

function ExpenseCard({ expense, splits, members, payerName, category, groupCurrency, showFx, canModify, onEdit, onDelete, t }: {
  expense: ExpenseWithSplits['expense']; splits: ExpenseWithSplits['splits']; members: GroupMemberRow[];
  payerName: string; category: Category; groupCurrency: string; showFx: boolean; canModify: boolean; onEdit: () => void; onDelete: () => void; t: (key: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: fxData } = useFxRate(expense.currency, groupCurrency);
  const fxDisplay = showFx && fxData?.rate && expense.currency !== groupCurrency
    ? `≈ ${formatAmount(Number(expense.amount) * fxData.rate, groupCurrency)}` : null;
  const dateFormatted = new Date(expense.expense_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  const hasNote = !!(expense as any).note;
  const positiveSplits = splits.filter((s) => Number(s.share_amount) > 0);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <TouchableOpacity style={styles.expenseCard} onPress={toggle} activeOpacity={0.95}>
      {/* Top row: category icon + expense name + amount */}
      <View style={styles.expenseCardHeader}>
        <View style={[styles.categoryIcon, { backgroundColor: CATEGORY_COLORS[category] + '20' }]}>
          <Ionicons name={CATEGORY_ICONS[category] as any} size={18} color={CATEGORY_COLORS[category]} />
        </View>
        <View style={styles.expenseContent}>
          {/* Row 1: name (flex:1) + amount (fixed right) */}
          <View style={styles.expenseTopRow}>
            <View style={styles.expenseNameRow}>
              <Text style={styles.expenseDesc} numberOfLines={2}>{expense.description}</Text>
              {hasNote && !expanded && (
                <Ionicons name="document-text-outline" size={13} color={palette.muted} style={{ marginLeft: 4 }} />
              )}
            </View>
            <View style={styles.expenseAmountCol}>
              <Text style={styles.expenseAmount}>{formatAmount(Number(expense.amount), expense.currency)}</Text>
              {fxDisplay && <Text style={styles.fxDisplayText}>{fxDisplay}</Text>}
            </View>
          </View>
          {/* Row 2: payer · date */}
          <Text style={styles.expenseMeta} numberOfLines={1}>
            {payerName} {t('expense.paidByLabel')} · {dateFormatted}
          </Text>
          {/* Row 3: category (left) + action buttons + chevron (right) */}
          <View style={styles.expenseCategoryRow}>
            <Text style={styles.expenseCategory}>{t(`categories.${category}`)}</Text>
            <View style={styles.expenseActions}>
              {canModify && (
                <>
                  <TouchableOpacity onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.actionBtn}>
                    <Ionicons name="pencil-outline" size={15} color={palette.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={15} color={palette.danger} />
                  </TouchableOpacity>
                </>
              )}
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={palette.muted} />
            </View>
          </View>
        </View>
      </View>

      {/* Expanded: note + full split detail */}
      {expanded && (
        <View style={styles.expandedSection}>
          {/* Note */}
          {hasNote && (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>{t('expense.note')}</Text>
              <Text style={styles.noteText}>{(expense as any).note}</Text>
            </View>
          )}

          {/* Split detail */}
          {positiveSplits.length > 0 && (
            <View style={styles.splitDetail}>
              <Text style={styles.splitDetailTitle}>{t('expense.splitPreview')}</Text>
              {positiveSplits.map((s) => {
                const m = members.find((mb) => mb.id === s.member_id);
                return (
                  <View key={s.id} style={styles.splitDetailRow}>
                    <View style={styles.splitDetailMember}>
                      <LinearGradient
                        colors={[m?.avatar_color ?? Colors.primary, `${m?.avatar_color ?? Colors.primary}BB`]}
                        style={styles.splitDetailAvatar}
                      >
                        <Text style={styles.splitDetailAvatarText}>
                          {(m?.display_name ?? '?').charAt(0).toLocaleUpperCase('tr-TR')}
                        </Text>
                      </LinearGradient>
                      <Text style={styles.splitDetailName}>{m?.display_name ?? '?'}</Text>
                    </View>
                    <Text style={styles.splitDetailAmount}>{formatAmount(Number(s.share_amount), expense.currency)}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Collapse hint */}
          <TouchableOpacity onPress={toggle} style={styles.collapseHint}>
            <Ionicons name="chevron-up" size={14} color={Colors.textTertiary} />
            <Text style={styles.collapseHintText}>{t('expense.closeDetail')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Activity helpers ──

function getActivityIcon(actionType: string): keyof typeof Ionicons.glyphMap {
  switch (actionType) {
    case 'expense_added': case 'expense_edited': case 'expense_updated': return 'cart-outline';
    case 'expense_deleted': return 'trash-outline';
    case 'settlement_marked': case 'settlement_confirmed': return 'checkmark-circle-outline';
    case 'settlement_rejected': return 'close-circle-outline';
    case 'member_joined': case 'member_added': case 'member_claimed': return 'person-add-outline';
    case 'member_deactivated': return 'person-remove-outline';
    case 'group_created': return 'people-outline';
    case 'group_archived': return 'archive-outline';
    default: return 'time-outline';
  }
}

function getActivityColor(actionType: string): string {
  switch (actionType) {
    case 'expense_added': case 'expense_edited': case 'expense_updated': return Colors.primary;
    case 'expense_deleted': return Colors.debt;
    case 'settlement_marked': return Colors.warning;
    case 'settlement_confirmed': return Colors.credit;
    case 'settlement_rejected': return Colors.debt;
    case 'member_joined': case 'member_added': case 'member_claimed': return Colors.credit;
    case 'member_deactivated': return Colors.textTertiary;
    default: return Colors.textTertiary;
  }
}

// ── Activity formatter ──

function formatActivity(a: ActivityLogRow, members: GroupMemberRow[], t: (k: string, opts?: Record<string, unknown>) => string): string {
  const actor = members.find((m) => m.id === a.actor_member_id);
  const name = actor?.display_name ?? t('activity.someone');
  const meta: any = a.metadata ?? {};
  switch (a.action_type) {
    case 'group_created': return t('activity.group_created', { name });
    case 'member_added': return t('activity.member_added', { name, target: meta.display_name ?? '' });
    case 'member_joined': return t('activity.member_joined', { name });
    case 'member_deactivated': return t('activity.member_deactivated', { name });
    case 'member_claimed':
      return t('activity.member_claimed', { name, target: meta.ghost_name ?? meta.display_name ?? '' });
    case 'expense_added': return t('activity.expense_added', { name, desc: meta.description ?? '', amount: meta.amount ? formatAmount(Number(meta.amount), meta.currency ?? 'TRY') : '?' });
    case 'expense_edited': return t('activity.expense_edited', { name, desc: meta.updates?.description ?? meta.description ?? '' });
    case 'expense_updated': return t('activity.expense_edited', { name, desc: meta.description ?? '' });
    case 'expense_deleted':
      return meta.description
        ? t('activity.expense_deleted', { name, desc: meta.description })
        : t('activity.expense_deleted_no_desc', { name });
    case 'group_archived': return t('activity.group_archived', { name });
    case 'settlement_confirmed':
      return t('activity.settlement_confirmed', { name });
    case 'settlement_marked':
      return t('activity.settlement_marked', {
        name,
        to: meta.to_name ?? members.find((m) => m.id === meta.to_member)?.display_name ?? '',
        amt: meta.amount ? formatAmount(Number(meta.amount), meta.currency ?? 'TRY') : '?',
      });
    case 'settlement_rejected':
      return t('activity.settlement_rejected', { name });
    default: return t('activity.genericActivity', { type: a.action_type });
  }
}

// ── Styles ──

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.surface },
  container: { flex: 1 },
  content: { paddingTop: 12, paddingHorizontal: spacing.md, paddingBottom: spacing.xxl * 2 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  emptyText: { color: palette.textSecondary, fontSize: fontSizes.md },
  headerGradient: { alignItems: 'center', paddingBottom: Spacing.xl, paddingHorizontal: Spacing.lg, borderRadius: Radius.xl },
  headerTopBar: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  headerNavButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  groupName: { fontFamily: Typography.fontDisplayBold, fontSize: Typography.size.xl, color: '#FFFFFF', marginTop: Spacing.sm },
  groupDescription: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.6)', marginTop: 4, textAlign: 'center', paddingHorizontal: Spacing.md },
  groupMeta: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  demoBadge: { marginTop: Spacing.sm, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm },
  demoBadgeText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs, color: '#FFFFFF' },
  sectionTitle: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs, color: Colors.textSecondary, letterSpacing: Typography.letterSpacing.wider, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  memberScroll: { marginBottom: spacing.md },
  memberChip: { alignItems: 'center', marginRight: spacing.md, width: 60 },
  memberAvatar: { width: 44, height: 44, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  addAvatar: { backgroundColor: palette.surface, borderWidth: 2, borderColor: palette.primary, borderStyle: 'dashed' },
  memberInitial: { fontSize: fontSizes.sm, fontWeight: '700', color: 'white' },
  memberName: { fontSize: fontSizes.xs, color: palette.textSecondary, marginTop: 2, textAlign: 'center' },
  // Tabs
  tabBar: { flexDirection: 'row', marginBottom: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  tabActive: { backgroundColor: Colors.surfaceTinted },
  tabText: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: Colors.textSecondary },
  tabTextActive: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.sm, color: Colors.primary },
  tabBadge: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.primary },
  // Expenses
  filterScroll: { marginBottom: spacing.sm },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radii.full, borderWidth: 1, borderColor: palette.border, marginRight: spacing.xs, backgroundColor: palette.background },
  filterChipActive: { backgroundColor: palette.primary + '15', borderColor: palette.primary },
  filterChipText: { fontSize: fontSizes.xs, color: palette.textSecondary },
  filterChipTextActive: { color: palette.primary, fontWeight: '600' },
  fxToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  fxToggleText: { fontSize: fontSizes.xs, color: palette.primary },
  placeholder: { backgroundColor: palette.background, borderRadius: radii.lg, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.md, borderWidth: 1, borderColor: palette.border, borderStyle: 'dashed' },
  placeholderText: { marginTop: spacing.sm, fontSize: fontSizes.md, color: palette.textSecondary },
  // Expense cards
  expenseCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.cardPadding, marginBottom: Spacing.sm, ...Shadows.sm },
  expenseCardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  categoryIcon: { width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  expenseContent: { flex: 1, marginLeft: Spacing.sm },
  expenseTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  expenseNameRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', marginRight: Spacing.sm },
  expenseDesc: { flex: 1, fontFamily: Typography.fontBodyBold, fontSize: Typography.size.base, color: Colors.textPrimary },
  expenseAmountCol: { alignItems: 'flex-end', flexShrink: 0 },
  expenseAmount: { fontFamily: Typography.fontDisplayMedium, fontSize: Typography.size.md, color: Colors.textPrimary },
  fxDisplayText: { fontFamily: Typography.fontBody, fontSize: Typography.size.xs, color: Colors.textTertiary, fontStyle: 'italic' },
  expenseMeta: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: Colors.textSecondary, marginTop: 5 },
  expenseCategoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  expenseCategory: { fontFamily: Typography.fontBodyMedium, fontSize: Typography.size.xs, color: Colors.textTertiary },
  expenseActions: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
  actionBtn: { padding: 4 },
  // Expanded card
  expandedSection: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs },
  noteBox: { backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  noteLabel: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs, color: Colors.textSecondary, marginBottom: 3 },
  noteText: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: Colors.textPrimary, fontStyle: 'italic', lineHeight: Typography.size.sm * 1.4 },
  splitDetail: { marginBottom: Spacing.sm },
  splitDetailTitle: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs, color: Colors.textSecondary, marginBottom: Spacing.xs },
  splitDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
  splitDetailMember: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  splitDetailDot: { width: 8, height: 8, borderRadius: 4 },
  splitDetailAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  splitDetailAvatarText: { fontFamily: Typography.fontBodyBold, fontSize: 10, color: 'white' },
  splitDetailName: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: Colors.textPrimary },
  splitDetailAmount: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.sm, color: Colors.textPrimary },
  collapseHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: Spacing.sm },
  collapseHintText: { fontFamily: Typography.fontBody, fontSize: Typography.size.xs, color: Colors.textTertiary },
  // Balances
  selfSummary: { borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  selfSummaryTitle: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.7)', letterSpacing: Typography.letterSpacing.wider, marginBottom: Spacing.md },
  selfRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginBottom: Spacing.xs },
  selfAmount: { fontFamily: Typography.fontDisplayBold, fontSize: Typography.size['3xl'], color: '#FFFFFF' },
  selfStatus: { fontFamily: Typography.fontBodyMedium, fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.7)' },
  modeToggle: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 4, marginBottom: Spacing.md },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.md },
  modeBtnActive: { backgroundColor: Colors.surface, ...Shadows.sm },
  modeBtnText: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: Colors.textSecondary },
  modeBtnTextActive: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.sm, color: Colors.primary },
  currencyBalanceCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.cardPadding, marginBottom: Spacing.sm, ...Shadows.sm },
  currencyBalanceTitle: { fontFamily: Typography.fontDisplayMedium, fontSize: Typography.size.md, color: Colors.primary, marginBottom: Spacing.sm },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 2 },
  balanceName: { flex: 1, fontFamily: Typography.fontBodyMedium, fontSize: Typography.size.sm, color: Colors.textPrimary },
  balanceAmount: { fontFamily: Typography.fontDisplayMedium, fontSize: Typography.size.sm },
  balanceStatus: { fontFamily: Typography.fontBody, fontSize: Typography.size.xs, width: 60, textAlign: 'right' },
  balancePositive: { color: Colors.credit },
  balanceNegative: { color: Colors.debt },
  simplifiedRow: { paddingVertical: Spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: Colors.border },
  simplifiedTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  simplifiedActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  simplifiedMembers: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  simplifiedFrom: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.sm, color: Colors.debt },
  simplifiedTo: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.sm, color: Colors.credit },
  simplifiedAmount: { fontFamily: Typography.fontDisplayMedium, fontSize: Typography.size.sm, color: Colors.textPrimary },
  actionIconBtn: { width: 30, height: 30, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  actionIconBtnWrap: { alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: 36, minHeight: 44 },
  actionIconLabel: { fontFamily: Typography.fontBody, fontSize: 9, color: Colors.credit, textAlign: 'center' },
  actionIconLabelBlue: { fontFamily: Typography.fontBody, fontSize: 9, color: Colors.primary, textAlign: 'center' },
  noDebts: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: Colors.textTertiary, fontStyle: 'italic', textAlign: 'center', paddingVertical: Spacing.sm },
  // Activity
  activitySectionTitle: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs, color: Colors.textSecondary, letterSpacing: Typography.letterSpacing.wider, marginBottom: Spacing.sm, marginTop: Spacing.lg },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  activityText: { flex: 1, fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: Colors.textSecondary },
  activityTime: { fontFamily: Typography.fontBody, fontSize: Typography.size.xs, color: Colors.textTertiary },
  // Settlement
  whatsappBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm, paddingVertical: spacing.xs },
  whatsappBtnText: { fontSize: fontSizes.sm, color: palette.primary, fontWeight: '500' },
  settleBtnNew: { backgroundColor: palette.primary, paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radii.md, minWidth: 64, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  settleBtnTextNew: { fontSize: fontSizes.xs, color: 'white', fontWeight: '700' },
  ibanBtnNew: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radii.md, borderWidth: 1.5, borderColor: palette.primary, minHeight: 38, backgroundColor: 'transparent' },
  ibanBtnText: { fontSize: fontSizes.xs, color: palette.primary, fontWeight: '600' },
  pendingCard: { backgroundColor: palette.warning + '10', borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: palette.warning + '30' },
  pendingBadge: { backgroundColor: palette.warning + '20', paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radii.md, borderWidth: 1, borderColor: palette.warning + '40', minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  pendingBadgeText: { fontSize: fontSizes.xs, color: palette.warning, fontWeight: '600' },
  pendingTitle: { fontSize: fontSizes.xs, fontWeight: '700', color: palette.warning, marginBottom: spacing.sm },
  pendingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  pendingText: { flex: 1, fontSize: fontSizes.xs, color: palette.textSecondary, marginRight: spacing.sm },
  confirmBtn: { backgroundColor: palette.success, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.sm },
  confirmBtnText: { fontSize: fontSizes.xs, color: 'white', fontWeight: '700' },
  rejectBtn: { backgroundColor: palette.danger, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.sm },
  rejectBtnText: { fontSize: fontSizes.xs, color: 'white', fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: palette.background, borderRadius: radii.xl, padding: spacing.lg, width: '100%', maxWidth: 340 },
  modalTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: palette.text, marginBottom: spacing.xs },
  modalSub: { fontSize: fontSizes.sm, color: palette.textSecondary, marginBottom: spacing.md },
  modalInput: { backgroundColor: palette.surface, borderRadius: radii.md, padding: spacing.md, fontSize: fontSizes.xxl, fontWeight: '700', color: palette.text, textAlign: 'center', borderWidth: 1, borderColor: palette.border, marginBottom: spacing.md },
  modalBtns: { flexDirection: 'row', gap: spacing.sm },
  modalCancel: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: palette.border },
  modalCancelText: { fontSize: fontSizes.sm, color: palette.textSecondary, fontWeight: '600' },
  modalConfirm: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: palette.primary },
  modalConfirmText: { fontSize: fontSizes.sm, color: 'white', fontWeight: '700' },
  // IBAN
  remindBtn: { paddingHorizontal: spacing.xs, paddingVertical: 3 },
  ibanInput: { backgroundColor: palette.surface, borderRadius: radii.md, padding: spacing.md, fontSize: fontSizes.md, color: palette.text, borderWidth: 1, borderColor: palette.border, marginBottom: spacing.sm, fontFamily: 'monospace', letterSpacing: 0.5 },
  ibanDisclaimer: { fontSize: fontSizes.xs, color: palette.muted, marginBottom: spacing.md, fontStyle: 'italic', textAlign: 'center' },
  ibanReceivedText: { backgroundColor: palette.surface, borderRadius: radii.md, padding: spacing.md, fontSize: fontSizes.lg, color: palette.text, borderWidth: 1, borderColor: palette.border, marginBottom: spacing.sm, fontFamily: 'monospace', fontWeight: '700', textAlign: 'center', letterSpacing: 1 },
  // FAB
  fab: { position: 'absolute', bottom: 32, right: 16, zIndex: 100, ...Shadows.fab },
  fabTouchable: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 28, minHeight: 52 },
  fabLabel: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.lg, color: 'white' },
});
