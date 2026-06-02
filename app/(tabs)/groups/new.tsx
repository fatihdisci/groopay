import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useCreateGroup } from '@/hooks/useGroups';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';

const MAX_NAME_LENGTH = 30;

export default function NewGroupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const createGroup = useCreateGroup();

  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!groupName.trim() || !user) return;
    setCreating(true);
    try {
      await createGroup.mutateAsync({
        name: groupName.trim(),
        currency: 'TRY',
        userId: user.id,
        displayName: user.display_name,
      });
      router.back();
    } catch (e: any) {
      Alert.alert(t('groups.createError'), e?.message ?? t('groups.createErrorDesc'));
    } finally {
      setCreating(false);
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
            <Ionicons name="people" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>{t('groups.newGroup')}</Text>
          <Text style={styles.heroSub}>{t('groups.newGroupDesc')}</Text>
        </LinearGradient>

        {/* ── Form ── */}
        <View style={styles.form}>
          <Text style={styles.sectionLabel}>{t('groups.groupName')}</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={groupName}
              onChangeText={setGroupName}
              placeholder={t('groups.createNamePlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              maxLength={MAX_NAME_LENGTH}
              autoFocus
            />
            <Text style={styles.charCount}>
              {groupName.length}/{MAX_NAME_LENGTH}
            </Text>
          </View>
          <View style={styles.hint}>
            <Ionicons name="bulb-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.hintText}>{t('groups.nameHint')}</Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Bottom button ── */}
      <View style={styles.bottom}>
        <TouchableOpacity
          style={[styles.createBtn, (!groupName.trim() || creating) && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={!groupName.trim() || creating}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[Colors.gradientStart, Colors.gradientEnd]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.createBtnGradient}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.createBtnText}>{t('groups.createBtn')}</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
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
  form: { padding: Spacing.xl, paddingTop: Spacing.xl },
  sectionLabel: {
    fontFamily: Typography.fontBodyBold,
    fontSize: 11,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  inputWrapper: { position: 'relative', marginBottom: Spacing.sm },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md + 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md + 2,
    paddingRight: 56,
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.backgroundSecondary,
  },
  charCount: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md + 2,
    fontFamily: Typography.fontBody,
    fontSize: 12,
    color: Colors.textTertiary,
  },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintText: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    flex: 1,
  },

  // ── Bottom button ──
  bottom: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  createBtn: { borderRadius: Radius.md, overflow: 'hidden', minHeight: 52 },
  btnDisabled: { opacity: 0.5 },
  createBtnGradient: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  createBtnText: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.base,
    color: '#FFFFFF',
  },
});
