import { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useCreateGroup } from '@/hooks/useGroups';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { palette, spacing, fontSizes, radii, minTouchTarget } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

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
      Alert.alert('Hata', e?.message ?? 'Grup oluşturulamadı');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.label}>{t('groups.createName')}</Text>
        <TextInput
          style={styles.input}
          value={groupName}
          onChangeText={setGroupName}
          placeholder={t('groups.createNamePlaceholder')}
          placeholderTextColor={palette.muted}
          maxLength={40}
          autoFocus
        />

        <TouchableOpacity
          style={styles.createBtn}
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
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.createBtnText}>{t('groups.createBtn')}</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: spacing.lg },
  form: { flex: 1, paddingTop: spacing.lg },
  label: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs, color: Colors.textSecondary, letterSpacing: 0.5, marginBottom: spacing.sm },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontSize: fontSizes.md, color: palette.text,
    backgroundColor: Colors.surface, minHeight: minTouchTarget,
    marginBottom: spacing.xl,
  },
  createBtn: { borderRadius: Radius.md, overflow: 'hidden' },
  createBtnGradient: { paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  createBtnText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.base, color: '#FFFFFF' },
});
