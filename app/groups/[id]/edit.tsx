import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGroupDetail, useDeleteGroup, useRemoveMember, useTransferOwnership } from '@/hooks/useGroupDetail';
import { useAuth } from '@/lib/auth';
import { updateGroup } from '@/lib/supabase/queries';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { palette, spacing, fontSizes, radii, minTouchTarget } from '@/constants/theme';
import { AVATAR_COLORS, getAvatarGradient } from '@/constants/avatarColors';
import Avatar from '@/components/Avatar';
import type { GroupMemberRow } from '@/lib/supabase/types';

const GROUP_EMOJIS = [
  '🏠', '🍽', '✈️', '🎉',
  '🚗', '🛒', '💰', '🏖',
  '🎬', '⚽', '🎓', '🐱',
  '🏢', '☕', '🎵', '💻',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toLocaleUpperCase('tr-TR');
  return (parts[0]?.[0] ?? '?').toLocaleUpperCase('tr-TR');
}

export default function EditGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGroupDetail(id!);
  const deleteGroupMut = useDeleteGroup();
  const removeMemberMut = useRemoveMember(id!);
  const transferMut = useTransferOwnership(id!);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarColor, setAvatarColor] = useState<string>(AVATAR_COLORS[0]!);
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showTransferPicker, setShowTransferPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formInitialized = useRef(false);
  useEffect(() => {
    if (data && !formInitialized.current) {
      formInitialized.current = true;
      setName(data.group.name);
      setDescription(data.group.description ?? '');
      setAvatarColor(data.group.avatar_color ?? AVATAR_COLORS[0]!);
      setAvatarEmoji(data.group.avatar_emoji ?? null);
    }
  }, [data]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }
  if (!data) return null;

  const { group, members, memberAvatarColors } = data;
  const myMember = members.find((m: GroupMemberRow) => m.user_id === user?.id);
  const isFounder = myMember?.role === 'founder';
  const activeMembers = members.filter((m: GroupMemberRow) => m.is_active);
  const activeCount = members.filter((m: GroupMemberRow) => m.is_active).length;

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('', t('groups.createNamePlaceholder'));
      return;
    }
    setSaving(true);
    try {
      await updateGroup(id!, {
        name: name.trim(),
        description: description.trim() || null,
        avatar_color: avatarColor,
        avatar_emoji: avatarEmoji,
      });
      queryClient.invalidateQueries({ queryKey: ['group', id!] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      router.back();
    } catch (e: any) {
      Alert.alert(t('members.errorTitle'), e?.message ?? t('settle.unknownError'));
    } finally {
      setSaving(false);
    }
  };

  const handleLeave = () => {
    if (!myMember) return;
    if (isFounder) {
      const others = activeMembers.filter((m) => m.id !== myMember.id);
      if (others.length === 0) {
        Alert.alert(t('group.leaveTitle'), t('group.leaveSoloFounder'), [
          { text: t('groups.cancel'), style: 'cancel' },
          { text: t('group.deleteGroup'), style: 'destructive', onPress: () => setShowDeleteConfirm(true) },
        ]);
      } else {
        setShowTransferPicker(true);
      }
    } else {
      setShowLeaveConfirm(true);
    }
  };

  const confirmLeave = async () => {
    if (!myMember) return;
    try { await removeMemberMut.mutateAsync(myMember.id); router.replace('/(tabs)/groups'); }
    catch (e: any) { Alert.alert(t('members.errorTitle'), e?.message ?? t('settle.unknownError')); }
  };

  const handleTransferAndLeave = async (newFounderId: string) => {
    if (!myMember) return;
    try {
      await transferMut.mutateAsync(newFounderId);
      await removeMemberMut.mutateAsync(myMember.id);
      setShowTransferPicker(false);
      router.replace('/(tabs)/groups');
    } catch (e: any) { Alert.alert(t('members.errorTitle'), e?.message ?? t('settle.unknownError')); }
  };

  const confirmDeleteGroup = async () => {
    try { await deleteGroupMut.mutateAsync(id!); router.replace('/(tabs)/groups'); }
    catch (e: any) { Alert.alert(t('members.errorTitle'), e?.message ?? t('settle.unknownError')); }
  };

  const initials = getInitials(name || group.name);
  const previewName = name.trim() || group.name;

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header — same as group detail */}
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <Text style={styles.editModeLabel}>{t('group.editMode')}</Text>

          <Avatar
            initials={initials}
            color={avatarColor}
            emoji={avatarEmoji}
            size={64}
          />
          <Text style={styles.groupName}>{previewName}</Text>
          {description.trim() ? (
            <Text style={styles.groupDescription}>{description.trim()}</Text>
          ) : null}
          <Text style={styles.groupMeta}>{activeCount} {t('groups.members')}</Text>
          {group.is_demo && (
            <View style={styles.demoBadge}><Text style={styles.demoBadgeText}>{t('groups.demoBadge')}</Text></View>
          )}
        </LinearGradient>

        {/* Edit form */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('groups.createName')}</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t('groups.createNamePlaceholder')} placeholderTextColor={palette.muted} maxLength={40} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('group.description')}</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder={t('group.descriptionPlaceholder')} placeholderTextColor={palette.muted} multiline numberOfLines={2} maxLength={120} textAlignVertical="top" />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('account.avatarColor')}</Text>
          <View style={styles.colorRow}>
            {AVATAR_COLORS.map((color) => {
              const gradient = getAvatarGradient(color);
              return (
                <TouchableOpacity key={color} style={[styles.colorCircle, { backgroundColor: gradient[0] }, avatarColor === color && styles.colorSelected]} onPress={() => setAvatarColor(color)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} />
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('group.emoji')}</Text>
          <View style={styles.emojiGrid}>
            {GROUP_EMOJIS.map((e) => (
              <TouchableOpacity key={e} style={[styles.emojiCell, avatarEmoji === e && styles.emojiCellSelected]} onPress={() => setAvatarEmoji(avatarEmoji === e ? null : e)}>
                <Text style={styles.emojiText}>{e}</Text>
              </TouchableOpacity>
            ))}
            {avatarEmoji && (
              <TouchableOpacity style={[styles.emojiCell, styles.emojiClear]} onPress={() => setAvatarEmoji(null)}>
                <Ionicons name="close" size={20} color={palette.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving} activeOpacity={0.9}>
          <LinearGradient colors={[Colors.gradientStart, Colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveButtonGradient}>
            {saving ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.saveButtonText}>{t('account.save')}</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.leaveButton} onPress={handleLeave} activeOpacity={0.7}>
          <Ionicons name="exit-outline" size={18} color={Colors.debt} />
          <Text style={styles.leaveButtonText}>{isFounder ? t('group.leaveAsFounder') : t('group.leaveGroup')}</Text>
        </TouchableOpacity>

        {isFounder && (
          <TouchableOpacity style={styles.deleteButton} onPress={() => setShowDeleteConfirm(true)} disabled={deleteGroupMut.isPending} activeOpacity={0.7}>
            {deleteGroupMut.isPending ? <ActivityIndicator size="small" color={Colors.debt} /> : (
              <><Ionicons name="trash-outline" size={18} color={Colors.debt} /><Text style={styles.deleteButtonText}>{t('group.deleteGroup')}</Text></>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: spacing.xxl }} />

        {/* Modals */}
        {showLeaveConfirm && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t('group.leaveTitle')}</Text>
              <Text style={styles.modalSub}>{t('group.leaveConfirm')}</Text>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowLeaveConfirm(false)}><Text style={styles.modalCancelText}>{t('groups.cancel')}</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.modalConfirm, { backgroundColor: Colors.debt }]} onPress={confirmLeave} disabled={removeMemberMut.isPending}>
                  {removeMemberMut.isPending ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.modalConfirmText}>{t('group.leaveGroup')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {showTransferPicker && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t('group.transferOwnership')}</Text>
              <Text style={styles.modalSub}>{t('group.transferRequired')}</Text>
              {activeMembers.filter((m) => m.id !== myMember?.id).map((m) => (
                <TouchableOpacity key={m.id} style={styles.transferOption} onPress={() => handleTransferAndLeave(m.id)} disabled={transferMut.isPending}>
                  <Avatar initials={getInitials(m.display_name)} color={m.user_id && memberAvatarColors ? memberAvatarColors[m.user_id] : undefined} ghostColor={!m.user_id ? palette.muted : undefined} size={36} />
                  <Text style={styles.transferName}>{m.display_name}</Text>
                  <Ionicons name="chevron-forward" size={18} color={palette.muted} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.modalCancel, { marginTop: spacing.md }]} onPress={() => setShowTransferPicker(false)}><Text style={styles.modalCancelText}>{t('groups.cancel')}</Text></TouchableOpacity>
            </View>
          </View>
        )}

        {showDeleteConfirm && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t('group.deleteGroup')}</Text>
              <Text style={styles.modalSub}>{t('group.deleteConfirm')}</Text>
              <Text style={styles.deleteWarning}>{t('group.deleteWarning')}</Text>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDeleteConfirm(false)}><Text style={styles.modalCancelText}>{t('groups.cancel')}</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.modalConfirm, { backgroundColor: Colors.debt }]} onPress={confirmDeleteGroup} disabled={deleteGroupMut.isPending}>
                  {deleteGroupMut.isPending ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.modalConfirmText}>{t('group.deleteGroup')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {(showLeaveConfirm || showTransferPicker || showDeleteConfirm) && <View style={styles.overlayBlocker} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },

  // Header — exact copy from group detail (+ edit mode label)
  headerGradient: { alignItems: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.lg, borderRadius: Radius.xl },
  editModeLabel: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: Spacing.sm },
  groupName: { fontFamily: Typography.fontDisplayBold, fontSize: Typography.size.xl, color: '#FFFFFF', marginTop: Spacing.sm },
  groupDescription: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.6)', marginTop: 4, textAlign: 'center', paddingHorizontal: Spacing.md },
  groupMeta: { fontFamily: Typography.fontBody, fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  demoBadge: { marginTop: Spacing.sm, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm },
  demoBadgeText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs, color: '#FFFFFF' },

  // Form
  field: { marginBottom: spacing.lg, marginTop: spacing.md },
  label: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.sm, color: Colors.textSecondary, marginBottom: spacing.sm, letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: palette.border, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: fontSizes.md, color: palette.text, backgroundColor: palette.surface, minHeight: minTouchTarget },
  textArea: { minHeight: 72, paddingTop: spacing.sm },

  colorRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  colorCircle: { width: 40, height: 40, borderRadius: radii.full },
  colorSelected: { borderWidth: 3, borderColor: palette.text, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emojiCell: { width: 52, height: 52, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  emojiCellSelected: { borderColor: palette.primary, borderWidth: 2, backgroundColor: palette.primary + '10' },
  emojiText: { fontSize: 24 },
  emojiClear: { borderStyle: 'dashed' },

  saveButton: { alignSelf: 'stretch', borderRadius: Radius.md, marginBottom: Spacing.lg, overflow: 'hidden' },
  saveButtonGradient: { paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  saveButtonText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.base, color: '#FFFFFF' },

  leaveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, backgroundColor: Colors.debtLight, borderRadius: Radius.md, marginBottom: Spacing.md },
  leaveButtonText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.base, color: Colors.debt },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, backgroundColor: Colors.debtLight, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.debt + '30' },
  deleteButtonText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.base, color: Colors.debt },
  deleteWarning: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.sm, color: Colors.debt, marginBottom: spacing.md, backgroundColor: Colors.debtLight, padding: spacing.sm, borderRadius: radii.sm },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl, zIndex: 200 },
  modalCard: { backgroundColor: palette.background, borderRadius: radii.xl, padding: spacing.lg, width: '100%', maxWidth: 340 },
  modalTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: palette.text, marginBottom: spacing.xs },
  modalSub: { fontSize: fontSizes.sm, color: palette.textSecondary, marginBottom: spacing.md },
  modalBtns: { flexDirection: 'row', gap: spacing.sm },
  modalCancel: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, minHeight: minTouchTarget },
  modalCancelText: { fontSize: fontSizes.md, color: palette.textSecondary, fontWeight: '600' },
  modalConfirm: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderRadius: radii.lg, minHeight: minTouchTarget },
  modalConfirmText: { fontSize: fontSizes.md, color: 'white', fontWeight: '700' },
  transferOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radii.md, backgroundColor: palette.surface, marginBottom: spacing.xs },
  transferName: { flex: 1, fontSize: fontSizes.md, color: palette.text, fontWeight: '500' },
  overlayBlocker: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent', zIndex: 199 },
});
