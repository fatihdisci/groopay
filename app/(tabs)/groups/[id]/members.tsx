import { useState, useLayoutEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGroupDetail, useAddGhostMember, useRemoveMember, useCreateInvite } from '@/hooks/useGroupDetail';
import { useAuth } from '@/lib/auth';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import Avatar from '@/components/Avatar';
import TipsButton from '@/components/TipsButton';
import type { GroupMemberRow } from '@/lib/supabase/types';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toLocaleUpperCase('tr-TR');
  return (parts[0]?.[0] ?? '?').toLocaleUpperCase('tr-TR');
}

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation();
  const { data, isLoading } = useGroupDetail(id!);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TipsButton
          title={t('tips.members.title')}
          tips={[
            { icon: 'person-outline' as const, text: t('tips.members.tip1') },
            { icon: 'link-outline' as const, text: t('tips.members.tip2') },
            { icon: 'shield-checkmark-outline' as const, text: t('tips.members.tip3') },
          ]}
        />
      ),
    });
  }, [navigation, t]);

  const addGhost = useAddGhostMember(id!);
  const removeMember = useRemoveMember(id!);
  const createInvite = useCreateInvite(id!);

  const [activePanel, setActivePanel] = useState<'ghost' | 'invite' | null>(null);
  const [ghostName, setGhostName] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }
  if (!data) return null;

  const { group, members, memberAvatarColors } = data;
  const myMember = members.find((m: GroupMemberRow) => m.user_id === user?.id);
  const isFounder = myMember?.role === 'founder';
  const activeMembers = members.filter((m: GroupMemberRow) => m.is_active);
  const inactiveMembers = members.filter((m: GroupMemberRow) => !m.is_active);

  const handleAddGhost = async () => {
    if (!ghostName.trim() || !myMember) return;
    try {
      await addGhost.mutateAsync({ displayName: ghostName.trim(), actorMemberId: myMember.id });
      setGhostName('');
      setActivePanel(null);
    } catch (e: any) {
      Alert.alert(t('members.errorTitle'), e?.message ?? t('members.addFailed'));
    }
  };

  const handleRemoveMember = (member: GroupMemberRow) => {
    if (member.user_id === user?.id) {
      Alert.alert(t('members.warning'), t('members.removeSelf'));
      return;
    }
    if (member.role === 'founder') {
      Alert.alert(t('members.warning'), t('members.removeLastFounder'));
      return;
    }
    Alert.alert(
      t('members.removeTitle'),
      t('members.removeConfirm', { name: member.display_name }),
      [
        { text: t('groups.cancel'), style: 'cancel' },
        {
          text: t('members.remove'),
          style: 'destructive',
          onPress: () => removeMember.mutate(member.id),
        },
      ],
    );
  };

  const handleLeaveGroup = () => {
    if (!myMember) return;
    Alert.alert(
      t('group.leaveTitle'),
      t('group.leaveConfirm'),
      [
        { text: t('groups.cancel'), style: 'cancel' },
        {
          text: t('group.leaveGroup'),
          style: 'destructive',
          onPress: () => removeMember.mutate(myMember.id),
        },
      ],
    );
  };

  const handleCreateInvite = async () => {
    if (!user) return;
    try {
      const invite = await createInvite.mutateAsync(user.id);
      setInviteCode(invite.token);
      setActivePanel('invite');
    } catch (e: any) {
      Alert.alert(t('members.errorTitle'), e?.message ?? t('members.inviteFailed'));
    }
  };

  const handleShare = async (code: string) => {
    await Share.share({ message: code });
  };

  const isMe = (member: GroupMemberRow) => member.user_id === user?.id;

  const renderMember = ({ item }: { item: GroupMemberRow }) => {
    const isCurrentUser = isMe(item);
    return (
      <View style={[styles.memberRow, !item.is_active && styles.inactiveRow]}>
        <Avatar
          initials={getInitials(item.display_name)}
          color={item.user_id && memberAvatarColors ? memberAvatarColors[item.user_id] : undefined}
          ghostColor={!item.user_id ? Colors.textTertiary : undefined}
          size={48}
        />
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={[styles.memberName, !item.is_active && styles.inactiveText]} numberOfLines={1}>
              {item.display_name}
            </Text>
            {item.role === 'founder' && (
              <View style={styles.founderBadge}>
                <Text style={styles.founderText}>{t('members.founder')}</Text>
              </View>
            )}
            {isCurrentUser && item.role !== 'founder' && (
              <View style={styles.selfBadge}>
                <Text style={styles.selfText}>{t('members.you')}</Text>
              </View>
            )}
            {!item.is_active && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>{t('members.inactive')}</Text>
              </View>
            )}
          </View>
          <View style={styles.memberSubRow}>
            {item.user_id ? (
              <Ionicons name="person-outline" size={12} color={Colors.textTertiary} />
            ) : (
              <Text style={styles.ghostIcon}>👻</Text>
            )}
            <Text style={styles.memberSub}>
              {item.user_id ? t('members.realMember') : t('members.ghost')}
            </Text>
          </View>
        </View>
        {/* Founder can remove any non-founder active member */}
        {isFounder && item.is_active && item.role !== 'founder' && !isCurrentUser && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => handleRemoveMember(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="person-remove-outline" size={20} color={Colors.debt} />
          </TouchableOpacity>
        )}
        {/* Regular member sees leave button for themselves */}
        {!isFounder && item.is_active && isCurrentUser && (
          <TouchableOpacity
            style={styles.leaveBtn}
            onPress={handleLeaveGroup}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.debt} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const allMembers = [...activeMembers, ...inactiveMembers];

  return (
    <View style={styles.container}>
      <FlatList
        data={allMembers}
        keyExtractor={(m) => m.id}
        renderItem={renderMember}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* ── Group title ── */}
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.groupMeta}>
              {activeMembers.length} {t('members.activeMembers')}
            </Text>

            {/* ── Action buttons ── */}
            <View style={styles.actionRow}>
              {/* Ghost add — ONLY founder */}
              {isFounder ? (
                <TouchableOpacity
                  style={styles.actionOutline}
                  onPress={() => setActivePanel(activePanel === 'ghost' ? null : 'ghost')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
                  <Text style={styles.actionOutlineText}>{t('members.addGhost')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.actionOutlineDisabled}>
                  <Ionicons name="person-add-outline" size={18} color={Colors.textTertiary} />
                  <Text style={styles.actionOutlineDisabledText}>{t('members.addGhost')}</Text>
                </View>
              )}

              {/* Invite link — all members */}
              <TouchableOpacity
                style={styles.actionGradient}
                onPress={() => {
                  if (activePanel === 'invite') {
                    setActivePanel(null);
                  } else {
                    handleCreateInvite();
                  }
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[Colors.gradientStart, Colors.gradientEnd]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.actionGradientFill}
                >
                  <Ionicons name="link-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.actionGradientText}>{t('members.invite')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* ── Inline ghost add form ── */}
            {activePanel === 'ghost' && (
              <View style={styles.panelCard}>
                <Text style={styles.panelLabel}>{t('members.addGhostTitle')}</Text>
                <TextInput
                  style={styles.panelInput}
                  value={ghostName}
                  onChangeText={setGhostName}
                  placeholder={t('members.addGhostPlaceholder')}
                  placeholderTextColor={Colors.textTertiary}
                  autoFocus
                />
                <View style={styles.panelActions}>
                  <TouchableOpacity onPress={() => { setActivePanel(null); setGhostName(''); }}>
                    <Text style={styles.panelClose}>{t('groups.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.panelBtn, !ghostName.trim() && styles.btnDisabled]}
                    onPress={handleAddGhost}
                    disabled={!ghostName.trim() || addGhost.isPending}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={ghostName.trim() ? [Colors.gradientStart, Colors.gradientEnd] : [Colors.border, Colors.border]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.panelBtnGradient}
                    >
                      {addGhost.isPending ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.panelBtnText}>{t('members.addGhostBtn')}</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Invite code box ── */}
            {activePanel === 'invite' && inviteCode && (
              <View style={styles.panelCard}>
                <Text style={styles.panelLabel}>{t('members.inviteCode')}</Text>
                <Text style={styles.inviteCode}>{inviteCode}</Text>
                <View style={styles.panelActions}>
                  <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare(inviteCode)}>
                    <LinearGradient
                      colors={[Colors.gradientStart, Colors.gradientEnd]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.shareBtnGradient}
                    >
                      <Ionicons name="share-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.shareText}>{t('members.inviteShare')}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setActivePanel(null); setInviteCode(null); }}>
                    <Text style={styles.panelClose}>{t('members.inviteClose')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Section label ── */}
            <Text style={styles.sectionLabel}>
              {t('members.membersSection', { count: allMembers.length })}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Text style={styles.emptyText}>{t('members.noMembers')}</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  listContent: { padding: Spacing.base, paddingBottom: Spacing['4xl'] },

  // ── Header ──
  headerSection: { marginBottom: Spacing.md },
  groupName: {
    fontFamily: Typography.fontDisplayBold,
    fontSize: Typography.size.xl,
    color: Colors.textPrimary,
  },
  groupMeta: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.lg,
  },

  // ── Action buttons ──
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  // Outline button (ghost add)
  actionOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  actionOutlineText: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.sm,
    color: Colors.primary,
  },
  actionOutlineDisabled: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    opacity: 0.6,
  },
  actionOutlineDisabledText: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
  },
  // Gradient button (invite)
  actionGradient: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  actionGradientFill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  actionGradientText: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.sm,
    color: '#FFFFFF',
  },

  // ── Section header ──
  sectionLabel: {
    fontFamily: Typography.fontBodyBold,
    fontSize: 11,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },

  // ── Expandable panel cards (ghost + invite share same style) ──
  panelCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  panelLabel: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  panelInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.backgroundSecondary,
    marginBottom: Spacing.md,
  },
  panelActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.md,
  },
  panelClose: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
    paddingVertical: Spacing.sm,
  },
  panelBtn: { borderRadius: Radius.md, overflow: 'hidden' },
  panelBtnGradient: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelBtnText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.sm, color: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },

  // ── Invite code (inside panel) ──
  inviteCode: {
    fontFamily: Typography.fontDisplayBold,
    fontSize: Typography.size['2xl'],
    color: Colors.primary,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  shareBtn: { borderRadius: Radius.md, overflow: 'hidden' },
  shareBtnGradient: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  shareText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.sm, color: '#FFFFFF' },

  // ── Member list ──
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: 60 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  inactiveRow: { opacity: 0.5 },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  memberName: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  inactiveText: { color: Colors.textTertiary, textDecorationLine: 'line-through' as const },

  // Badges
  founderBadge: {
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  founderText: { fontFamily: Typography.fontBodyBold, fontSize: 10, color: Colors.warning },
  selfBadge: {
    backgroundColor: Colors.primaryGhost,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  selfText: { fontFamily: Typography.fontBodyBold, fontSize: 10, color: Colors.primary },
  inactiveBadge: {
    backgroundColor: Colors.textTertiary + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  inactiveBadgeText: { fontFamily: Typography.fontBodyBold, fontSize: 10, color: Colors.textTertiary },

  // Member sub row
  memberSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  ghostIcon: { fontSize: 11 },
  memberSub: { fontFamily: Typography.fontBody, fontSize: Typography.size.xs, color: Colors.textSecondary },

  // Action icons
  removeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.debt + '10' },
  leaveBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.debt + '10' },

  // Empty
  emptyList: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontFamily: Typography.fontBody, fontSize: Typography.size.base, color: Colors.textSecondary },

});
