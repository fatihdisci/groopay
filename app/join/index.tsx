import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { getInviteByToken, joinViaInvite } from '@/lib/supabase/queries';
import { supabase, getSupabaseAccessToken } from '@/lib/supabase/client';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import type { GroupMemberRow } from '@/lib/supabase/types';

export default function JoinScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [code, setCode] = useState('');
  const [step, setStep] = useState<'enter' | 'preview' | 'joining'>('enter');
  const [preview, setPreview] = useState<{ token: string; groupName: string; memberCount: number; groupId: string } | null>(null);
  const [ghosts, setGhosts] = useState<GroupMemberRow[]>([]);
  const [selectedGhostId, setSelectedGhostId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!code.trim()) return;
    setErrorMsg(null);
    const invite = await getInviteByToken(code.trim());
    if (!invite) {
      setErrorMsg(t('join.invalidCode'));
      return;
    }
    const { data: members } = await supabase
      .rpc('preview_ghosts', { p_token: invite.token });

    setPreview({
      token: invite.token,
      groupName: invite.group_name,
      memberCount: invite.member_count,
      groupId: invite.group_id,
    });
    setGhosts((members ?? []) as GroupMemberRow[]);
    setSelectedGhostId(null);
    setStep('preview');
  };

  const handleJoin = async () => {
    if (!user || !preview) return;
    setErrorMsg(null);
    setStep('joining');
    try {
      const token = getSupabaseAccessToken();
      if (!token) throw new Error(t('join.noSession'));

      await joinViaInvite(preview.token, token, {
        claimGhostMemberId: selectedGhostId ?? undefined,
        displayName: user.display_name,
      });

      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group'] });

      Alert.alert(t('join.success'), t('join.successDesc', { name: preview.groupName }), [
        { text: t('join.ok'), onPress: () => router.replace('/(tabs)/groups') },
      ]);
    } catch (e: any) {
      setErrorMsg(e?.message ?? t('join.error'));
      setStep('preview');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Gradient Hero ── */}
        <LinearGradient
          colors={[Colors.gradientStart, Colors.gradientEnd]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroIcon}>
            <Ionicons name="enter-outline" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>{t('join.title')}</Text>
          <Text style={styles.heroSub}>{t('join.subtitle')}</Text>
        </LinearGradient>

        {/* ── Content ── */}
        <View style={styles.form}>
          {step === 'enter' && (
            <>
              <Text style={styles.sectionLabel}>{t('join.codeLabel')}</Text>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="ABC123"
                placeholderTextColor={Colors.textTertiary}
                maxLength={8}
                autoCapitalize="characters"
                autoFocus
              />
              <Text style={styles.codeHint}>{t('join.codeHint')}</Text>
              {errorMsg && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={14} color={Colors.debt} />
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              )}
            </>
          )}

          {step === 'preview' && preview && (
            <>
              {/* Group preview card */}
              <View style={styles.previewCard}>
                <View style={styles.previewIcon}>
                  <Ionicons name="people" size={36} color={Colors.primary} />
                </View>
                <Text style={styles.previewName}>{preview.groupName}</Text>
                <Text style={styles.previewMeta}>
                  {preview.memberCount + 1} {t('join.memberCount')}
                </Text>
              </View>

              {/* Ghost claim */}
              {ghosts.length > 0 && (
                <View style={styles.claimSection}>
                  <Text style={styles.claimTitle}>{t('members.claimTitle')}</Text>
                  {ghosts.map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.claimOption, selectedGhostId === g.id && styles.claimOptionSelected]}
                      onPress={() => setSelectedGhostId(g.id)}
                    >
                      <Ionicons
                        name={selectedGhostId === g.id ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={selectedGhostId === g.id ? Colors.primary : Colors.textTertiary}
                      />
                      <View style={styles.claimInfo}>
                        <Text style={styles.claimName}>{g.display_name}</Text>
                        <Text style={styles.claimDesc}>{t('members.claimGhost')}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.claimOption, selectedGhostId === '' && styles.claimOptionSelected]}
                    onPress={() => setSelectedGhostId('')}
                  >
                    <Ionicons
                      name={selectedGhostId === '' ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selectedGhostId === '' ? Colors.primary : Colors.textTertiary}
                    />
                    <View style={styles.claimInfo}>
                      <Text style={styles.claimName}>{t('members.claimNew')}</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {errorMsg && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={14} color={Colors.debt} />
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              )}
            </>
          )}

          {step === 'joining' && (
            <View style={styles.joiningBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.joiningText}>{t('members.joining')}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Bottom button ── */}
      <View style={styles.bottom}>
        {step === 'enter' && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, !code.trim() && styles.btnDisabled]}
              onPress={handleLookup}
              disabled={!code.trim()}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={code.trim() ? [Colors.gradientStart, Colors.gradientEnd] : [Colors.border, Colors.border]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.actionBtnGradient}
              >
                <Text style={styles.actionBtnText}>{t('join.findGroup')}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>{t('join.cancel')}</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'preview' && preview && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, ghosts.length > 0 && selectedGhostId === null && styles.btnDisabled]}
              onPress={handleJoin}
              disabled={ghosts.length > 0 && selectedGhostId === null}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[Colors.gradientStart, Colors.gradientEnd]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.actionBtnGradient}
              >
                <Text style={styles.actionBtnText}>{t('join.joinGroup')}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setStep('enter'); setErrorMsg(null); }} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>{t('join.back')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: Spacing.xl,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontFamily: Typography.fontDisplayBold,
    fontSize: Typography.size.xl,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroSub: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.sm,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },

  // ── Form ──
  form: { padding: Spacing.xl },
  sectionLabel: {
    fontFamily: Typography.fontBodyBold,
    fontSize: 11,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  codeInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md + 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md + 2,
    fontFamily: Typography.fontDisplayMedium,
    fontSize: 22,
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 6,
    backgroundColor: Colors.backgroundSecondary,
  },
  codeHint: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },

  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.debt + '10',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  errorText: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.sm,
    color: Colors.debt,
    flex: 1,
  },

  // ── Preview ──
  previewCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary + '30',
    ...Shadows.sm,
  },
  previewIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primaryGhost,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  previewName: {
    fontFamily: Typography.fontDisplayBold,
    fontSize: Typography.size.xl,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  previewMeta: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },

  // ── Claim ──
  claimSection: { marginBottom: Spacing.lg },
  claimTitle: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  claimOption: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  claimOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryGhost,
  },
  claimInfo: { flex: 1 },
  claimName: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
  },
  claimDesc: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },

  // ── Joining ──
  joiningBox: { alignItems: 'center', paddingVertical: 40 },
  joiningText: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },

  // ── Bottom ──
  bottom: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  actionBtn: { borderRadius: Radius.md, overflow: 'hidden', minHeight: 52 },
  btnDisabled: { opacity: 0.5 },
  actionBtnGradient: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  actionBtnText: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.base,
    color: '#FFFFFF',
  },
  cancelBtn: { paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelText: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    paddingVertical: Spacing.sm,
  },
});
