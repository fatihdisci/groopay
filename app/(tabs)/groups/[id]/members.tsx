import { useState } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Share, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGroupDetail, useAddGhostMember, useDeactivateMember, useRemoveMember, useCreateInvite } from '@/hooks/useGroupDetail';
import { useAuth } from '@/lib/auth';
import { palette, spacing, fontSizes, radii, minTouchTarget } from '@/constants/theme';
import Avatar from '@/components/Avatar';
import type { GroupMemberRow, GroupInviteRow } from '@/lib/supabase/types';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toLocaleUpperCase('tr-TR');
  return (parts[0]?.[0] ?? '?').toLocaleUpperCase('tr-TR');
}

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data, isLoading } = useGroupDetail(id!);
  const addGhost = useAddGhostMember(id!);
  const deactivate = useDeactivateMember(id!);
  const removeMember = useRemoveMember(id!);
  const createInvite = useCreateInvite(id!);

  const [showAdd, setShowAdd] = useState(false);
  const [ghostName, setGhostName] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={palette.primary} /></View>;
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
      setShowAdd(false);
    } catch (e: any) {
      Alert.alert(t('members.errorTitle'), e?.message ?? t('members.addFailed'));
    }
  };

  const handleDeactivate = (member: GroupMemberRow) => {
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
    } catch (e: any) {
      Alert.alert(t('members.errorTitle'), e?.message ?? t('members.inviteFailed'));
    }
  };

  const handleShare = async (code: string) => {
    await Share.share({ message: code });
  };

  const renderMember = ({ item }: { item: GroupMemberRow }) => (
    <View style={[styles.memberRow, !item.is_active && styles.inactiveRow]}>
      <Avatar
        initials={getInitials(item.display_name)}
        color={item.user_id && memberAvatarColors ? memberAvatarColors[item.user_id] : undefined}
        ghostColor={!item.user_id ? palette.muted : undefined}
        size={44}
      />
      <View style={styles.memberInfo}>
        <View style={styles.memberNameRow}>
          <Text style={[styles.memberName, !item.is_active && styles.inactiveText]}>
            {item.display_name}
          </Text>
          {!item.user_id && item.is_active && (
            <Ionicons name="person-outline" size={14} color={palette.muted} />
          )}
          {item.role === 'founder' && (
            <View style={styles.founderBadge}>
              <Text style={styles.founderText}>{t('members.founder')}</Text>
            </View>
          )}
          {!item.is_active && (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>{t('members.inactive')}</Text>
            </View>
          )}
        </View>
        <Text style={styles.memberSub}>
          {item.user_id ? t('members.realMember') : t('members.ghost')}
        </Text>
      </View>
      {/* Founder can remove any non-founder active member */}
      {isFounder && item.is_active && item.role !== 'founder' && (
        <TouchableOpacity
          onPress={() => handleDeactivate(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="remove-circle-outline" size={22} color={palette.danger} />
        </TouchableOpacity>
      )}
      {/* Regular member sees leave button for themselves */}
      {!isFounder && item.is_active && item.user_id === user?.id && (
        <TouchableOpacity
          onPress={handleLeaveGroup}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="exit-outline" size={22} color={palette.danger} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={[...activeMembers, ...inactiveMembers]}
        keyExtractor={(m) => m.id}
        renderItem={renderMember}
        ListHeaderComponent={
          <View>
            {/* Group info */}
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.groupMeta}>{activeMembers.length} {t('members.activeMembers')}</Text>

            {/* Actions */}
            <View style={styles.actions}>
              {isFounder ? (
                <TouchableOpacity style={styles.actionBtn} onPress={() => setShowAdd(true)} activeOpacity={0.7}>
                  <Ionicons name="person-add-outline" size={18} color={palette.primary} />
                  <Text style={styles.actionText}>{t('members.addGhost')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.actionBtnDisabled}>
                  <Ionicons name="person-add-outline" size={18} color={palette.muted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTextDisabled}>{t('members.addGhost')}</Text>
                    <Text style={styles.actionHint}>{t('members.ghostFounderOnly')}</Text>
                  </View>
                </View>
              )}
              <TouchableOpacity style={styles.actionBtn} onPress={handleCreateInvite} activeOpacity={0.7}>
                <Ionicons name="link-outline" size={18} color={palette.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionText}>{t('members.invite')}</Text>
                  <Text style={styles.actionHint}>{t('members.inviteHint')}</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Invite code */}
            {inviteCode && (
              <View style={styles.inviteBox}>
                <Text style={styles.inviteLabel}>{t('members.inviteCode')}</Text>
                <Text style={styles.inviteCode}>{inviteCode}</Text>
                <View style={styles.inviteActions}>
                  <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare(inviteCode)}>
                    <Ionicons name="share-outline" size={16} color="white" />
                    <Text style={styles.shareText}>{t('members.inviteShare')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setInviteCode(null)}>
                    <Text style={styles.closeInvite}>{t('members.inviteClose')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Add ghost modal */}
      <Modal visible={showAdd} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('members.addGhost')}</Text>
            <TextInput
              style={styles.input}
              value={ghostName}
              onChangeText={setGhostName}
              placeholder={t('members.addGhostName')}
              placeholderTextColor={palette.muted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
                <Text style={styles.cancelText}>{t('groups.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addBtn, !ghostName.trim() && styles.btnDisabled]}
                onPress={handleAddGhost}
                disabled={!ghostName.trim() || addGhost.isPending}
              >
                {addGhost.isPending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.addText}>{t('members.addGhostBtn')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  groupName: { fontSize: fontSizes.xl, fontWeight: '700', color: palette.text },
  groupMeta: { fontSize: fontSizes.sm, color: palette.textSecondary, marginTop: 2, marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.md, borderWidth: 1, borderColor: palette.primary,
  },
  actionText: { fontSize: fontSizes.sm, color: palette.primary, fontWeight: '500' },
  actionBtnDisabled: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.md, borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.surface, opacity: 0.7,
  },
  actionTextDisabled: { fontSize: fontSizes.sm, color: palette.muted, fontWeight: '500' },
  actionHint: { fontSize: fontSizes.xs, color: palette.muted, marginTop: 1 },
  // Invite
  inviteBox: {
    backgroundColor: palette.surface, borderRadius: radii.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: palette.primary,
    marginBottom: spacing.lg,
  },
  inviteLabel: { fontSize: fontSizes.sm, color: palette.textSecondary, marginBottom: spacing.xs },
  inviteCode: { fontSize: fontSizes.xxl, fontWeight: '800', color: palette.primary, letterSpacing: 4, textAlign: 'center' },
  inviteActions: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.md },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: palette.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md,
  },
  shareText: { color: 'white', fontWeight: '600' },
  closeInvite: { color: palette.muted, paddingVertical: spacing.sm },
  // Members
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: palette.border,
  },
  inactiveRow: { opacity: 0.6 },
  memberAvatar: { width: 40, height: 40, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  memberInitial: { fontSize: fontSizes.sm, fontWeight: '700', color: 'white' },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  memberName: { fontSize: fontSizes.md, fontWeight: '500', color: palette.text },
  inactiveText: { color: palette.muted, textDecorationLine: 'line-through' },
  founderBadge: {
    backgroundColor: palette.warning + '20', paddingHorizontal: spacing.xs,
    paddingVertical: 1, borderRadius: radii.sm,
  },
  founderText: { fontSize: 10, color: palette.warning, fontWeight: '600' },
  inactiveBadge: {
    backgroundColor: palette.muted + '20', paddingHorizontal: spacing.xs,
    paddingVertical: 1, borderRadius: radii.sm,
  },
  inactiveBadgeText: { fontSize: 10, color: palette.muted },
  memberSub: { fontSize: fontSizes.xs, color: palette.muted, marginTop: 2 },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.xl },
  modalContent: { backgroundColor: palette.background, borderRadius: radii.xl, padding: spacing.lg },
  modalTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: palette.text, marginBottom: spacing.lg },
  input: {
    borderWidth: 1, borderColor: palette.border, borderRadius: radii.md,
    padding: spacing.md, fontSize: fontSizes.md, color: palette.text,
    backgroundColor: palette.surface, marginBottom: spacing.lg, minHeight: minTouchTarget,
  },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border,
    minHeight: minTouchTarget,
  },
  cancelText: { fontSize: fontSizes.md, color: palette.textSecondary },
  addBtn: {
    flex: 2, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md, borderRadius: radii.lg, backgroundColor: palette.primary,
    minHeight: minTouchTarget,
  },
  btnDisabled: { opacity: 0.5 },
  addText: { fontSize: fontSizes.md, fontWeight: '600', color: 'white' },
});
