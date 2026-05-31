import { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useGroups, useCreateGroup } from '@/hooks/useGroups';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase/client';
import { usePro } from '@/hooks/usePro';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { palette, spacing, fontSizes, radii, minTouchTarget } from '@/constants/theme';
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
  const createGroup = useCreateGroup();
  const { isUserPro } = usePro();

  // Count non-demo groups created by the user
  const { data: createdGroupCount } = useQuery({
    queryKey: ['created-group-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('groups')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .eq('is_demo', false);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  const reachedLimit = !isUserPro && (createdGroupCount ?? 0) >= MAX_FREE_GROUPS;
  const nearLimit = !isUserPro && (createdGroupCount ?? 0) === MAX_FREE_GROUPS - 1;

  const handleFabPress = () => {
    if (reachedLimit) {
      router.push('/paywall?context=limit');
      return;
    }
    setModalVisible(true);
  };

  const handleCreate = async () => {
    if (!groupName.trim() || !user) return;
    if (reachedLimit) {
      router.push('/paywall?context=limit');
      return;
    }
    setCreating(true);
    try {
      await createGroup.mutateAsync({ name: groupName.trim(), currency: 'TRY', userId: user.id, displayName: user.display_name });
      setModalVisible(false);
      setGroupName('');
    } catch (e: any) {
      Alert.alert('Hata', e?.message ?? 'Grup oluşturulamadı');
    } finally {
      setCreating(false);
    }
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
                      <View style={styles.proBadge}>
                        <Text style={styles.proBadgeText}>{t('pro.badge')}</Text>
                      </View>
                    )}
                    {item.group.is_demo && (
                      <View style={styles.demoBadge}>
                        <Text style={styles.demoBadgeText}>{t('groups.demoBadge')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardMeta}>
                    {activeMemberCount} {t('groups.members')}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
            </FadeInUp>
          );
        }}
      />

      {/* FAB — Create Group (gradient) */}
      <View style={styles.fab}>
        {nearLimit && !reachedLimit && (
          <View style={styles.fabNearLimitBadge}>
            <Text style={styles.fabNearLimitBadgeText}>{t('groups.oneLeft')}</Text>
          </View>
        )}
        <TouchableOpacity onPress={handleFabPress} activeOpacity={0.9}>
          {reachedLimit ? (
            <LinearGradient colors={['#9CA3AF', '#9CA3AF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabTouchable}>
              <Ionicons name="lock-closed" size={20} color="white" />
              <Text style={styles.fabLabel}>{t('groups.proUnlimited')}</Text>
            </LinearGradient>
          ) : (
            <LinearGradient colors={[Colors.gradientStart, Colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabTouchable}>
              <Ionicons name="add" size={22} color="white" />
              <Text style={styles.fabLabel}>{t('groups.createFab')}</Text>
            </LinearGradient>
          )}
        </TouchableOpacity>
      </View>

      {/* Join button */}
      <TouchableOpacity
        style={styles.joinButton}
        onPress={handleJoinPress}
        activeOpacity={0.7}
      >
        <Ionicons name="enter-outline" size={18} color={Colors.primary} />
        <Text style={styles.joinButtonText}>{t('groups.join')}</Text>
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('groups.create')}</Text>

            <Text style={styles.label}>{t('groups.createName').toLocaleUpperCase('tr-TR')}</Text>
            <TextInput
              style={styles.input}
              value={groupName}
              onChangeText={setGroupName}
              placeholder={t('groups.createNamePlaceholder')}
              placeholderTextColor={palette.muted}
              maxLength={40}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setModalVisible(false); setGroupName(''); }}
              >
                <Text style={styles.cancelText}>{t('groups.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, (!groupName.trim() || creating) && styles.btnDisabled]}
                onPress={handleCreate}
                disabled={!groupName.trim() || creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.createText}>{t('groups.createBtn')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyInner: { alignItems: 'center', padding: Spacing.xl },
  emptyTitle: {
    fontFamily: Typography.fontDisplayMedium,
    fontSize: Typography.size.lg,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  list: { padding: Spacing.base, gap: Spacing.sm },

  // Overall balance card (gradient)
  obCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.base,
    ...Shadows.lg,
  },
  obLabel: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.xs,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: Typography.letterSpacing.wider,
    marginBottom: Spacing.md,
  },
  obRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  obRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  obCurrencyBadge: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.xs,
    color: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    marginRight: Spacing.md,
    minWidth: 50,
    textAlign: 'center',
  },
  obAmount: {
    fontFamily: Typography.fontDisplayBold,
    fontSize: Typography.size['2xl'],
    color: '#FFFFFF',
    flex: 1,
  },
  obAmountCredit: {
    color: '#D1FAE5',
  },
  obStatus: {
    fontFamily: Typography.fontBodyMedium,
    fontSize: Typography.size.sm,
    color: 'rgba(255,255,255,0.65)',
  },

  // Group card
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.cardPadding,
    ...Shadows.md,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.md, minWidth: 0 },
  cardInfo: { flex: 1, minWidth: 0 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  cardName: {
    fontFamily: Typography.fontDisplayMedium,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  cardMeta: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  proBadge: {
    backgroundColor: Colors.pro + '20',
    paddingHorizontal: Spacing.sm - 2,
    paddingVertical: 1,
    borderRadius: Radius.sm,
  },
  proBadgeText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs - 1, color: Colors.pro },
  demoBadge: {
    backgroundColor: Colors.demo + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  demoBadgeText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs - 1, color: Colors.demo },

  // FAB
  fab: {
    position: 'absolute', bottom: 80, right: Spacing.lg,
    zIndex: 100,
    ...Shadows.fab,
  },
  fabTouchable: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: 28, minHeight: 52,
  },
  fabLabel: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.lg,
    color: 'white',
  },
  fabNearLimitBadge: {
    position: 'absolute', top: -8, right: 0,
    backgroundColor: Colors.warning,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
    borderRadius: Radius.sm, zIndex: 2,
  },
  fabNearLimitBadgeText: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.xs,
    color: 'white',
  },

  // Join button
  joinButton: {
    position: 'absolute', bottom: Spacing.base, left: Spacing.base, right: Spacing.base,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, paddingVertical: Spacing.md,
    backgroundColor: Colors.primaryGhost,
    borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  joinButtonText: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.base,
    color: Colors.primary,
  },

  // Modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.xl, paddingBottom: Spacing['4xl'],
  },
  modalTitle: {
    fontFamily: Typography.fontDisplay,
    fontSize: Typography.size.xl,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  label: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    letterSpacing: Typography.letterSpacing.wider,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.md, fontSize: Typography.size.base,
    fontFamily: Typography.fontBody,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
    marginBottom: Spacing.lg,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.md },
  cancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  cancelText: { fontFamily: Typography.fontBodyMedium, fontSize: Typography.size.base, color: Colors.textSecondary },
  createBtn: {
    flex: 2, alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
  },
  btnDisabled: { opacity: 0.5 },
  createText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.base, color: 'white' },
});
