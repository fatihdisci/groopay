import { useState, useLayoutEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, Alert, ActivityIndicator,
  TextInput, Platform, Modal, KeyboardAvoidingView, TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useRouter, useNavigation } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGroups } from '@/hooks/useGroups';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase/client';
import { getInviteByToken, joinViaInvite } from '@/lib/supabase/queries';
import { useCreateGroup } from '@/hooks/useGroups';
import { usePro } from '@/hooks/usePro';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { palette, spacing, fontSizes, radii } from '@/constants/theme';
import Avatar from '@/components/Avatar';
import { FadeInUp } from '@/components/Animations';
import type { GroupWithMembers } from '@/lib/supabase/types';

const MAX_FREE_GROUPS = 5;
const MAX_NAME_LENGTH = 30;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toLocaleUpperCase('tr-TR');
  return (parts[0]?.[0] ?? '?').toLocaleUpperCase('tr-TR');
}

export default function GroupsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: groups, isLoading } = useGroups();
  const { isUserPro } = usePro();
  const createGroup = useCreateGroup();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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

  // Modal state
  const [activeModal, setActiveModal] = useState<'new' | 'join' | null>(null);
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const closeModal = () => {
    setActiveModal(null);
    setGroupName('');
    setJoinCode('');
    setJoinError(null);
  };

  const handleCreatePress = () => {
    if (reachedLimit) { router.push('/paywall?context=limit'); return; }
    setActiveModal('new');
  };

  const handleJoinPress = () => {
    setActiveModal('join');
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || !user) return;
    setCreating(true);
    try {
      await createGroup.mutateAsync({
        name: groupName.trim(), currency: 'TRY',
        userId: user.id, displayName: user.display_name,
      });
      closeModal();
    } catch (e: any) {
      Alert.alert(t('groups.createError'), e?.message ?? t('groups.createErrorDesc'));
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!joinCode.trim() || !user) return;
    setJoinError(null);
    const invite = await getInviteByToken(joinCode.trim());
    if (!invite) { setJoinError(t('join.invalidCode')); return; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error(t('join.noSession'));
      await joinViaInvite(invite.token, token, { displayName: user.display_name });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group'] });
      closeModal();
      Alert.alert(t('join.success'), t('join.successDesc', { name: invite.group_name }), [{ text: t('join.ok') }]);
    } catch (e: any) {
      setJoinError(e?.message ?? t('join.error'));
    }
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
                      {item.group.is_pro && <View style={styles.proBadge}><Text style={styles.proBadgeText}>{t('pro.badge')}</Text></View>}
                      {item.group.is_demo && <View style={styles.demoBadge}><Text style={styles.demoBadgeText}>{t('groups.demoBadge')}</Text></View>}
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

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {nearLimit && !reachedLimit && (
          <View style={styles.limitBadge}>
            <Text style={styles.limitBadgeText}>{t('groups.oneLeft')}</Text>
          </View>
        )}
        <View style={styles.bottomRow}>
          <TouchableOpacity style={styles.joinButton} onPress={handleJoinPress} activeOpacity={0.7}>
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

      {/* ── NEW GROUP MODAL ── */}
      <Modal visible={activeModal === 'new'} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={styles.modalWrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={closeModal}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.sheet}>
            <View style={styles.dragHandle} />
            <Text style={styles.sheetTitle}>{t('groups.newGroup')}</Text>
            <View style={styles.sheetInputWrapper}>
              <TextInput
                style={styles.sheetInput}
                value={groupName}
                onChangeText={setGroupName}
                placeholder={t('groups.createNamePlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                maxLength={MAX_NAME_LENGTH}
                autoFocus
              />
              <Text style={styles.charCounter}>{groupName.length}/{MAX_NAME_LENGTH}</Text>
            </View>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetCancel} onPress={closeModal}>
                <Text style={styles.sheetCancelText}>{t('groups.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, !groupName.trim() && styles.btnDisabled]}
                onPress={handleCreateGroup}
                disabled={!groupName.trim() || creating}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={groupName.trim() ? [Colors.gradientStart, Colors.gradientEnd] : [Colors.border, Colors.border]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.sheetBtnGradient}
                >
                  {creating ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.sheetBtnText}>{t('groups.createBtn')}</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── JOIN GROUP MODAL ── */}
      <Modal visible={activeModal === 'join'} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={styles.modalWrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={closeModal}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.sheet}>
            <View style={styles.dragHandle} />
            <Text style={styles.sheetTitle}>{t('join.title')}</Text>
            <TextInput
              style={[styles.sheetInput, styles.sheetCodeInput, { marginBottom: Spacing.md }]}
              value={joinCode}
              onChangeText={(val) => setJoinCode(val.toLocaleUpperCase('tr-TR'))}
              placeholder="ABC123"
              placeholderTextColor={Colors.textTertiary}
              maxLength={8}
              autoCapitalize="characters"
              autoFocus
            />
            {joinError && (
              <View style={styles.sheetError}>
                <Ionicons name="alert-circle-outline" size={14} color={Colors.debt} />
                <Text style={styles.sheetErrorText}>{joinError}</Text>
              </View>
            )}
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetCancel} onPress={closeModal}>
                <Text style={styles.sheetCancelText}>{t('groups.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, !joinCode.trim() && styles.btnDisabled]}
                onPress={handleJoinGroup}
                disabled={!joinCode.trim()}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={joinCode.trim() ? [Colors.gradientStart, Colors.gradientEnd] : [Colors.border, Colors.border]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.sheetBtnGradient}
                >
                  <Text style={styles.sheetBtnText}>{t('join.findGroup')}</Text>
                </LinearGradient>
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
  bottomBar: { backgroundColor: Colors.background, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  bottomRow: { flexDirection: 'row', gap: 10 },
  limitBadge: { position: 'absolute', top: -10, right: 16, backgroundColor: Colors.warning, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm, zIndex: 2 },
  limitBadgeText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs, color: 'white' },
  joinButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: 'transparent' },
  joinButtonText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.base, color: Colors.primary },
  createButton: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  createButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 52 },
  createButtonText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.base, color: 'white' },

  // ── Modal / Bottom Sheet ──
  modalWrapper: { flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    ...Shadows.lg,
  },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontFamily: Typography.fontDisplayBold, fontSize: Typography.size.lg, color: Colors.textPrimary, marginBottom: Spacing.lg },
  sheetInputWrapper: { position: 'relative', marginBottom: Spacing.lg },
  sheetInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md + 2,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md + 2, paddingRight: 56,
    fontFamily: Typography.fontBody, fontSize: Typography.size.base, color: Colors.textPrimary,
    backgroundColor: Colors.backgroundSecondary,
    letterSpacing: -0.2,
  },
  sheetCodeInput: { textAlign: 'center', letterSpacing: 4, fontFamily: Typography.fontDisplayMedium, fontSize: 22, paddingRight: Spacing.md },
  charCounter: {
    position: 'absolute', right: Spacing.md, bottom: Spacing.md + 2,
    fontFamily: Typography.fontBody, fontSize: 12, color: Colors.textTertiary,
    backgroundColor: Colors.backgroundSecondary, paddingLeft: 8,
  },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.md },
  sheetCancel: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  sheetCancelText: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: Colors.textSecondary },
  sheetBtn: { borderRadius: 10, overflow: 'hidden' },
  sheetBtnGradient: { paddingHorizontal: Spacing.lg, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  sheetBtnText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.sm, color: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },
  sheetError: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.debt + '10', borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.md },
  sheetErrorText: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: Colors.debt, flex: 1 },
});
