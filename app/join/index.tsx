import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { getInviteByToken, joinViaInvite } from '@/lib/supabase/queries';
import { supabase } from '@/lib/supabase/client';
import { palette, spacing, fontSizes, radii, minTouchTarget } from '@/constants/theme';
import type { GroupMemberRow } from '@/lib/supabase/types';

export default function JoinScreen() {
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
      setErrorMsg('Bu davet kodu geçerli değil veya süresi dolmuş.');
      return;
    }
    // Use RPC to bypass RLS — caller is not yet a group member
    const { data: members } = await supabase
      .rpc('preview_ghosts', { p_token: invite.token });

    setPreview({
      token: invite.token,
      groupName: invite.group_name,
      memberCount: invite.member_count,
      groupId: invite.group_id,
    });
    setGhosts((members ?? []) as GroupMemberRow[]);
    // Default: if ghosts exist, pre-select none (force user to choose)
    setSelectedGhostId(null);
    setStep('preview');
  };

  const handleJoin = async () => {
    if (!user || !preview) return;
    setErrorMsg(null);
    setStep('joining');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı');

      await joinViaInvite(preview.token, token, {
        claimGhostMemberId: selectedGhostId ?? undefined,
        displayName: user.display_name,
      });

      // Clear cache so groups screen refetches fresh data
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group'] });

      Alert.alert('Katıldınız!', `"${preview.groupName}" grubuna katıldınız.`, [
        { text: 'Tamam', onPress: () => router.replace('/(tabs)/groups') },
      ]);
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Gruba katılınamadı');
      setStep('preview');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView contentContainerStyle={styles.scrollInner} keyboardShouldPersistTaps="handled">
      {step === 'enter' && (
        <View style={styles.form}>
          <Ionicons name="enter-outline" size={64} color={palette.primary} style={styles.icon} />
          <Text style={styles.title}>Gruba Katıl</Text>
          <Text style={styles.subtitle}>Davet kodunu gir</Text>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="ABC123"
            placeholderTextColor={palette.muted}
            maxLength={8}
            autoCapitalize="characters"
            autoFocus
          />
          {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
          <TouchableOpacity
            style={[styles.lookupBtn, !code.trim() && styles.btnDisabled]}
            onPress={handleLookup}
            disabled={!code.trim()}
          >
            <Text style={styles.lookupText}>Grubu Bul</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>Vazgeç</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'preview' && preview && (
        <View style={styles.form}>
          <View style={styles.previewCard}>
            <Ionicons name="people" size={48} color={palette.primary} />
            <Text style={styles.previewName}>{preview.groupName}</Text>
            <Text style={styles.previewMeta}>{preview.memberCount + 1} üye (seninle)</Text>
          </View>

          {/* Ghost claim — show if ghosts exist */}
          {ghosts.length > 0 && (
            <View style={styles.claimSection}>
              <Text style={styles.claimTitle}>Bu grupta sen kimsin?</Text>
              <Text style={styles.claimSubtitle}>Bir hayalet üyeyi devral veya yeni üye olarak katıl</Text>
              {ghosts.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.claimOption, selectedGhostId === g.id && styles.claimSelected]}
                  onPress={() => setSelectedGhostId(g.id)}
                >
                  <Ionicons
                    name={selectedGhostId === g.id ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selectedGhostId === g.id ? palette.primary : palette.muted}
                  />
                  <View style={styles.claimInfo}>
                    <Text style={styles.claimName}>{g.display_name}</Text>
                    <Text style={styles.claimSub}>geçmişi devral</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.claimOption, selectedGhostId === '' && styles.claimSelected]}
                onPress={() => setSelectedGhostId('')}
              >
                <Ionicons
                  name={selectedGhostId === '' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selectedGhostId === '' ? palette.primary : palette.muted}
                />
                <View style={styles.claimInfo}>
                  <Text style={styles.claimName}>Yeni üye olarak katıl</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

          <TouchableOpacity
            style={[styles.lookupBtn, ghosts.length > 0 && selectedGhostId === null && styles.btnDisabled]}
            onPress={handleJoin}
            disabled={ghosts.length > 0 && selectedGhostId === null}
          >
            <Text style={styles.lookupText}>Gruba Katıl</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setStep('enter'); setErrorMsg(null); }}>
            <Text style={styles.backText}>Geri</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'joining' && (
        <View style={styles.form}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.joiningText}>Katılıyor...</Text>
        </View>
      )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scrollInner: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  form: { alignItems: 'center' },
  icon: { marginBottom: spacing.md },
  title: { fontSize: fontSizes.xxl, fontWeight: '700', color: palette.text },
  subtitle: { fontSize: fontSizes.md, color: palette.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
  codeInput: {
    width: '100%', maxWidth: 280,
    borderWidth: 2, borderColor: palette.primary, borderRadius: radii.lg,
    padding: spacing.md, fontSize: fontSizes.xxl, fontWeight: '800',
    color: palette.text, textAlign: 'center', letterSpacing: 6,
    backgroundColor: palette.surface, marginBottom: spacing.md, minHeight: minTouchTarget,
  },
  error: {
    color: palette.danger, fontSize: fontSizes.sm, textAlign: 'center',
    marginBottom: spacing.sm, maxWidth: 280,
  },
  lookupBtn: {
    width: '100%', maxWidth: 280, alignItems: 'center',
    backgroundColor: palette.primary, paddingVertical: spacing.md,
    borderRadius: radii.lg, minHeight: minTouchTarget, justifyContent: 'center',
    marginBottom: spacing.md,
  },
  btnDisabled: { opacity: 0.5 },
  lookupText: { color: 'white', fontSize: fontSizes.md, fontWeight: '600' },
  backText: { color: palette.muted, fontSize: fontSizes.md, marginTop: spacing.md },
  previewCard: {
    backgroundColor: palette.surface, borderRadius: radii.xl,
    padding: spacing.xl, alignItems: 'center', marginBottom: spacing.lg,
    borderWidth: 1, borderColor: palette.border, width: '100%', maxWidth: 320,
  },
  previewName: { fontSize: fontSizes.xl, fontWeight: '700', color: palette.text, marginTop: spacing.sm },
  previewMeta: { fontSize: fontSizes.sm, color: palette.textSecondary, marginTop: 2 },
  claimSection: { width: '100%', maxWidth: 320, marginBottom: spacing.lg },
  claimTitle: { fontSize: fontSizes.md, fontWeight: '600', color: palette.text, marginBottom: spacing.xs },
  claimSubtitle: { fontSize: fontSizes.xs, color: palette.textSecondary, marginBottom: spacing.md },
  claimOption: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm + 4, paddingHorizontal: spacing.md,
    borderRadius: radii.md, borderWidth: 1, borderColor: palette.border,
    marginBottom: spacing.xs,
  },
  claimSelected: { borderColor: palette.primary, backgroundColor: palette.primary + '08' },
  claimInfo: { flex: 1 },
  claimName: { fontSize: fontSizes.md, color: palette.text, fontWeight: '500' },
  claimSub: { fontSize: fontSizes.xs, color: palette.muted },
  joiningText: { fontSize: fontSizes.md, color: palette.textSecondary, marginTop: spacing.md },
});
