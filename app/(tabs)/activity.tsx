import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TextInput, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useRealtimeAllGroups } from '@/hooks/useRealtime';
import { usePro } from '@/hooks/usePro';
import { formatAmount } from '@/lib/finance/money';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { palette, spacing, fontSizes, radii } from '@/constants/theme';
import type { ActivityLogRow, GroupMemberRow, GroupRow } from '@/lib/supabase/types';

// ── Activity icon helpers ──
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
    default: return 'ellipse-outline';
  }
}
function getActivityColor(actionType: string): string {
  switch (actionType) {
    case 'expense_added': case 'expense_edited': case 'expense_updated': return Colors.primary;
    case 'expense_deleted': return Colors.debt;
    case 'settlement_marked': return Colors.warning;
    case 'settlement_confirmed': return Colors.credit;
    case 'settlement_rejected': return Colors.debt;
    case 'member_joined': case 'member_added': case 'member_claimed': return '#7C3AED';
    default: return Colors.textTertiary;
  }
}

function timeAgo(dateStr: string, t: (k: string, o?: any) => string): string {
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

export default function ActivityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isUserPro } = usePro();

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(text);
    }, 300);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
  }, []);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const { data: myGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ['my-group-ids'],
    queryFn: async () => {
      const { data } = await supabase.from('group_members').select('group_id').eq('is_active', true);
      return [...new Set((data ?? []).map((m: any) => m.group_id))] as string[];
    },
    staleTime: 60_000,
  });

  const groupIds = myGroups ?? [];
  useRealtimeAllGroups(groupIds);

  const { data: activityData, isLoading } = useQuery({
    queryKey: ['activity-all', groupIds],
    queryFn: async () => {
      if (groupIds.length === 0) return { activity: [], memberNames: new Map<string, string>(), groupNames: new Map<string, string>() };

      const [activityRes, membersRes, groupsRes] = await Promise.all([
        supabase
          .from('activity_log')
          .select('*')
          .in('group_id', groupIds)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('group_members')
          .select('id, display_name')
          .in('group_id', groupIds),
        supabase
          .from('groups')
          .select('id, name')
          .in('id', groupIds),
      ]);

      const memberNames = new Map<string, string>();
      for (const m of (membersRes.data ?? []) as Pick<GroupMemberRow, 'id' | 'display_name'>[]) {
        memberNames.set(m.id, m.display_name);
      }

      const groupNames = new Map<string, string>();
      for (const g of (groupsRes.data ?? []) as Pick<GroupRow, 'id' | 'name'>[]) {
        groupNames.set(g.id, g.name);
      }

      return {
        activity: (activityRes.data ?? []) as ActivityLogRow[],
        memberNames,
        groupNames,
      };
    },
    enabled: groupIds.length > 0,
    staleTime: 10_000,
  });

  const activity = activityData?.activity ?? [];
  const memberNames = activityData?.memberNames ?? new Map();
  const groupNames = activityData?.groupNames ?? new Map();

  // Search filter + group by date
  const isSearching = debouncedQuery.length > 0;

  const groupedByDate = useMemo(() => {
    const filtered = isSearching
      ? activity.filter((a) => {
          const q = debouncedQuery.toLocaleLowerCase('tr-TR');
          const actorName = a.actor_member_id ? (memberNames.get(a.actor_member_id) ?? '') : '';
          const groupName = groupNames.get(a.group_id) ?? '';
          const desc = (a.metadata as any)?.description ?? '';
          const amount = (a.metadata as any)?.amount != null ? String((a.metadata as any).amount) : '';

          // Build searchable text for this activity row
          const searchText = [
            actorName,
            groupName,
            desc,
            amount,
            // Also include formatted activity text for i18n matching
            formatActivity(a, actorName || null, memberNames, t),
          ].join(' ').toLocaleLowerCase('tr-TR');

          return searchText.includes(q);
        })
      : activity;

    const groups = new Map<string, ActivityLogRow[]>();
    for (const a of filtered) {
      const dateKey = new Date(a.created_at).toLocaleDateString('tr-TR', {
        weekday: 'long', day: 'numeric', month: 'long',
      });
      const list = groups.get(dateKey) ?? [];
      list.push(a);
      groups.set(dateKey, list);
    }
    return groups;
  }, [activity, debouncedQuery, memberNames, groupNames, t]);

  const hasResults = groupedByDate.size > 0;

  if (groupsLoading || isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* ── Search Bar ── */}
      {activity.length > 0 || isSearching ? (
        isUserPro ? (
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={handleSearchChange}
                placeholder={t('activity.searchPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                returnKeyType="search"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.searchContainer}
            onPress={() => router.push('/paywall?context=feature')}
            activeOpacity={0.7}
          >
            <View style={[styles.searchBar, styles.searchBarLocked]}>
              <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
              <Text style={styles.searchPlaceholder}>{t('activity.searchPlaceholder')}</Text>
              <Ionicons name="lock-closed" size={14} color={Colors.primary} />
            </View>
          </TouchableOpacity>
        )
      ) : null}

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {activity.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="time-outline" size={64} color={palette.muted} />
            <Text style={styles.emptyText}>{t('activity.empty')}</Text>
          </View>
        ) : hasResults ? (
          [...groupedByDate.entries()].map(([dateLabel, items]) => (
            <View key={dateLabel} style={styles.dateGroup}>
              <Text style={styles.dateLabel}>{dateLabel.toLocaleUpperCase('tr-TR')}</Text>
              {items.map((a) => {
                const actorName = a.actor_member_id ? memberNames.get(a.actor_member_id) : null;
                const groupName = groupNames.get(a.group_id) ?? '';
                const iconColor = getActivityColor(a.action_type);
                return (
                  <View key={a.id} style={styles.row}>
                    <View style={[styles.activityIconDot, { backgroundColor: iconColor + '20' }]}>
                      <Ionicons name={getActivityIcon(a.action_type)} size={12} color={iconColor} />
                    </View>
                    <View style={styles.rowContent}>
                      <Text style={styles.rowText} numberOfLines={2}>
                        {formatActivity(a, actorName, memberNames, t)}
                      </Text>
                      <View style={styles.rowMeta}>
                        {groupName ? <Text style={styles.rowGroup}>{groupName}</Text> : null}
                        <Text style={styles.rowTime}>{timeAgo(a.created_at, t)}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        ) : (
          <View style={styles.centered}>
            <Ionicons name="search-outline" size={48} color={palette.muted} />
            <Text style={styles.emptyText}>{t('activity.noSearchResults')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function formatActivity(
  a: ActivityLogRow,
  actorName: string | null,
  memberNames: Map<string, string>,
  t: (k: string, o?: any) => string,
): string {
  const meta: any = a.metadata ?? {};
  const name = actorName ?? t('activity.someone');
  switch (a.action_type) {
    case 'group_created':
      return t('activity.group_created', { name });
    case 'member_added':
      return t('activity.member_added', { name, target: meta.display_name ?? '?' });
    case 'member_joined':
      return t('activity.member_joined', { name });
    case 'member_deactivated':
      return t('activity.member_deactivated', { name });
    case 'member_claimed':
      return t('activity.member_claimed', {
        name,
        target: meta.ghost_name ?? meta.display_name ?? t('activity.unknownMember'),
      });
    case 'expense_added':
      return t('activity.expense_added', {
        name,
        desc: meta.description ?? '?',
        amount: meta.amount ? formatAmount(Number(meta.amount), meta.currency ?? 'TRY') : '?',
      });
    case 'expense_edited':
      return t('activity.expense_edited', { name, desc: meta.updates?.description ?? meta.description ?? '?' });
    case 'expense_updated':
      return t('activity.expense_edited', { name, desc: meta.description ?? '?' });
    case 'expense_deleted':
      return meta.description
        ? t('activity.expense_deleted', { name, desc: meta.description })
        : t('activity.expense_deleted_no_desc', { name });
    case 'group_archived':
      return t('activity.group_archived', { name });
    case 'settlement_confirmed':
      return t('activity.settlement_confirmed', { name });
    case 'settlement_marked':
      return t('activity.settlement_marked', {
        name,
        to: meta.to_name ?? memberNames.get(meta.to_member) ?? '?',
        amt: meta.amount ? formatAmount(Number(meta.amount), meta.currency ?? 'TRY') : '?',
      });
    case 'settlement_rejected':
      return t('activity.settlement_rejected', { name });
    default:
      return t('activity.genericActivity', { type: a.action_type });
  }
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { padding: Spacing.base, paddingBottom: Spacing['4xl'] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  emptyText: { marginTop: Spacing.md, fontFamily: Typography.fontBody, fontSize: Typography.size.base, color: Colors.textSecondary },

  // Search
  searchContainer: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: Spacing.sm, backgroundColor: Colors.background },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
  },
  searchBarLocked: { opacity: 0.7 },
  searchInput: { flex: 1, fontFamily: Typography.fontBody, fontSize: 15, color: Colors.textPrimary, paddingVertical: 0 },
  searchPlaceholder: { flex: 1, fontFamily: Typography.fontBody, fontSize: 15, color: Colors.textTertiary },

  // Date grouping
  dateGroup: { marginBottom: Spacing.lg },
  dateLabel: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    letterSpacing: Typography.letterSpacing.wider,
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.sm,
  },

  // Activity row
  row: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, paddingLeft: Spacing.xs },
  activityIconDot: { width: 24, height: 24, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  rowContent: { flex: 1 },
  rowText: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: Colors.textPrimary, lineHeight: Typography.size.sm * 1.5 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 3 },
  rowGroup: {
    fontFamily: Typography.fontBodyMedium,
    fontSize: Typography.size.xs,
    color: Colors.primary,
    backgroundColor: Colors.surfaceTinted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  rowTime: { fontFamily: Typography.fontBody, fontSize: Typography.size.xs, color: Colors.textTertiary },
});
