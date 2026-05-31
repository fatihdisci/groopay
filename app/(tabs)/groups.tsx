import { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useGroups } from '@/hooks/useGroups';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase/client';
import { usePro } from '@/hooks/usePro';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { palette, spacing, fontSizes, radii } from '@/constants/theme';
import Avatar from '@/components/Avatar';
import { FadeInUp } from '@/components/Animations';
import type { GroupWithMembers } from '@/lib/supabase/types';

const MAX_FREE_GROUPS = 5;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toLocaleUpperCase('tr-TR');
  return (parts[0]?.[0] ?? '?').toLocaleUpperCase('tr-TR');
}

export default function GroupsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { data: groups, isLoading } = useGroups();
  const { isUserPro } = usePro();

  const { data: createdGroupCount } = useQuery({
    queryKey: ['created-group-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('groups').select('*', { count: 'exact', head: true })
        .eq('created_by', user.id).eq('is_demo', false);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const reachedLimit = !isUserPro && (createdGroupCount ?? 0) >= MAX_FREE_GROUPS;
  const nearLimit = !isUserPro && (createdGroupCount ?? 0) === MAX_FREE_GROUPS - 1;

  const handleCreatePress = () => {
    if (reachedLimit) {
      router.push('/paywall?context=limit');
      return;
    }
    router.push('/groups/new');
  };

  const handleJoinPress = () => {
    router.push('/join');
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  const activeGroups = groups ?? [];

  return (
    <View style={styles.container}>
      <FlatList
        data={activeGroups}
        keyExtractor={(g) => g.group.id}
        contentContainerStyle={activeGroups.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Ionicons name="people-outline" size={64} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>{t('groups.emptyTitle')}</Text>
            <Text style={styles.emptySubtitle}>{t('groups.emptySubtitle')}</Text>
          </View>
        }
        renderItem={({ item, index }: { item: GroupWithMembers; index: number }) => {
          const activeMemberCount = item.members.filter((m) => m.is_active).length;
          return (
            <FadeInUp key={item.group.id} delay={index * 40} distance={8}>
              <TouchableOpacity
                style={styles.groupCard}
                onPress={() => router.push(`/groups/${item.group.id}`)}
                activeOpacity={0.95}
              >
                <View style={styles.cardLeft}>
                  <Avatar initials={getInitials(item.group.name)} color={item.group.avatar_color} emoji={item.group.avatar_emoji} size={48} />
                  <View style={styles.cardInfo}>
                    <View style={styles.cardNameRow}>
                      <Text style={styles.cardName}>{item.group.name}</Text>
                      {item.group.is_pro && (
                        <View style={styles.proBadge}><Text style={styles.proBadgeText}>{t('pro.badge')}</Text></View>
                      )}
                      {item.group.is_demo && (
                        <View style={styles.demoBadge}><Text style={styles.demoBadgeText}>{t('groups.demoBadge')}</Text></View>
                      )}
                    </View>
                    <Text style={styles.cardMeta}>{activeMemberCount} {t('groups.members')}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </FadeInUp>
          );
        }}
      />

      {/* Bottom bar — two side-by-side buttons */}
      <View style={styles.bottomBar}>
        {nearLimit && !reachedLimit && (
          <View style={styles.limitBadge}>
            <Text style={styles.limitBadgeText}>{t('groups.oneLeft')}</Text>
          </View>
        )}
        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={styles.joinButton}
            onPress={handleJoinPress}
            activeOpacity={0.7}
          >
            <Ionicons name="enter-outline" size={18} color={Colors.primary} />
            <Text style={styles.joinButtonText}>{t('groups.join')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreatePress}
            activeOpacity={0.9}
            disabled={reachedLimit}
          >
            <LinearGradient
              colors={reachedLimit ? ['#9CA3AF', '#9CA3AF'] : [Colors.gradientStart, Colors.gradientEnd]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.createButtonGradient}
            >
              {reachedLimit ? (
                <Ionicons name="lock-closed" size={18} color="white" />
              ) : (
                <Ionicons name="add" size={20} color="white" />
              )}
              <Text style={styles.createButtonText}>
                {reachedLimit ? t('groups.proUnlimited') : t('groups.createFab')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyInner: { alignItems: 'center', padding: Spacing.xl },
  emptyTitle: { fontFamily: Typography.fontDisplayMedium, fontSize: Typography.size.lg, color: Colors.textPrimary, marginTop: Spacing.md, textAlign: 'center' },
  emptySubtitle: { fontFamily: Typography.fontBody, fontSize: Typography.size.base, color: Colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: 100 },

  // Group card
  groupCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.cardPadding, ...Shadows.md },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.md, minWidth: 0 },
  cardInfo: { flex: 1, minWidth: 0 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  cardName: { fontFamily: Typography.fontDisplayMedium, fontSize: Typography.size.base, color: Colors.textPrimary, flexShrink: 1 },
  cardMeta: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: Colors.textSecondary, marginTop: 2 },
  proBadge: { backgroundColor: Colors.pro + '20', paddingHorizontal: Spacing.sm - 2, paddingVertical: 1, borderRadius: Radius.sm },
  proBadgeText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs - 1, color: Colors.pro },
  demoBadge: { backgroundColor: Colors.demo + '20', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  demoBadgeText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs - 1, color: Colors.demo },

  // Bottom bar
  bottomBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
  },
  bottomRow: { flexDirection: 'row', gap: 10 },
  limitBadge: {
    position: 'absolute', top: -10, right: 16,
    backgroundColor: Colors.warning,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
    borderRadius: Radius.sm, zIndex: 2,
  },
  limitBadgeText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs, color: 'white' },

  // Join button (outline)
  joinButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 52, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  joinButtonText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.base, color: Colors.primary },

  // Create button (gradient)
  createButton: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  createButtonGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 52,
  },
  createButtonText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.base, color: 'white' },
});
