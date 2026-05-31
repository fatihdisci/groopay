import { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth, AVATAR_COLORS } from '@/lib/auth';
import { getAvatarHeaderGradient } from '@/constants/avatarColors';
import { usePro } from '@/hooks/usePro';
import { isRevenueCatAvailable, restorePurchases } from '@/lib/revenuecat';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { palette, spacing, fontSizes, radii, minTouchTarget } from '@/constants/theme';
import i18n from '@/lib/i18n';
import Toast, { ToastType } from '@/components/Toast';
import Avatar from '@/components/Avatar';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toLocaleUpperCase('tr-TR');
  }
  return (parts[0]?.[0] ?? '?').toLocaleUpperCase('tr-TR');
}

export default function AccountScreen() {
  const { t } = useTranslation();
  const { user, updateProfile, signOut } = useAuth();
  const { isUserPro } = usePro();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [selectedColor, setSelectedColor] = useState(user?.avatar_color ?? AVATAR_COLORS[0]!);
  const [language, setLanguage] = useState(user?.locale ?? 'tr');
  const [restoring, setRestoring] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({ visible: false, message: '', type: 'success' });

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ visible: true, message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      await updateProfile({
        display_name: displayName.trim() || user.display_name,
        avatar_color: selectedColor,
        locale: language,
      });
      await i18n.changeLanguage(language);
      // Invalidate group queries so member avatars reflect new color
      queryClient.invalidateQueries({ queryKey: ['group'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      showToast(t('account.profileSaved'), 'success');
    } catch (e: any) {
      showToast(t('account.profileSaveError'), 'error');
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('account.signOut'), t('account.signOutConfirm'), [
      { text: t('account.cancel'), style: 'cancel' },
      {
        text: t('account.signOut'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          queryClient.clear();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  };

  const handleRestore = async () => {
    if (!isRevenueCatAvailable()) {
      Alert.alert(t('paywall.devBuildTitle'), t('paywall.devBuildMessage'));
      return;
    }
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.success) {
        Alert.alert(t('paywall.restoreTitle'), t('paywall.restoreSuccess'));
      } else {
        Alert.alert(t('paywall.restoreTitle'), t('paywall.restoreEmpty'));
      }
    } finally {
      setRestoring(false);
    }
  };

  if (!user) return null;

  const initials = getInitials(displayName || user.display_name);

  return (
    <View style={styles.wrapper}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Gradient mini-header */}
      <LinearGradient
        colors={getAvatarHeaderGradient(selectedColor) as [string, string]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <Avatar initials={initials} color={selectedColor} size={64} />
        <Text style={styles.headerName}>{displayName || user.display_name}</Text>
        <View style={[styles.proPill, isUserPro ? styles.proPillActive : styles.proPillFree]}>
          <Text style={[styles.proPillText, isUserPro ? styles.proPillTextActive : styles.proPillTextFree]}>
            {isUserPro ? t('pro.userProBadge') : t('account.freeStatus')}
          </Text>
        </View>
      </LinearGradient>

      {/* Pro Status Section */}
      <View style={styles.proSection}>
        <Text style={styles.sectionLabel}>{t('account.proStatus').toLocaleUpperCase('tr-TR')}</Text>
        {isUserPro ? (
          <View style={styles.proActiveCard}>
            <Ionicons name="checkmark-circle" size={20} color={palette.success} />
            <View style={styles.proActiveInfo}>
              <Text style={styles.proActiveTitle}>{t('account.userPro')}</Text>
              <Text style={styles.proActiveDesc}>{t('account.userProActive')}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.freeCard}>
            <View style={styles.freeInfo}>
              <Text style={styles.freeTitle}>{t('account.freeStatus')}</Text>
              <Text style={styles.freeDesc}>{t('account.freeStatusDesc')}</Text>
            </View>
            <TouchableOpacity
              style={styles.goProButton}
              onPress={() => router.push('/paywall?context=limit')}
              activeOpacity={0.7}
            >
              <Text style={styles.goProButtonText}>{t('account.goPro')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Dashboard link */}
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => router.push('/dashboard')}
        activeOpacity={0.7}
      >
        <View style={styles.menuItemLeft}>
          <Ionicons name="stats-chart-outline" size={20} color={palette.primary} />
          <View style={styles.menuItemInfo}>
            <Text style={styles.menuItemTitle}>{t('account.dashboard')}</Text>
            <Text style={styles.menuItemDesc}>{t('account.dashboardDesc')}</Text>
          </View>
        </View>
        {!isUserPro && <Ionicons name="lock-closed" size={16} color={palette.muted} />}
        <Ionicons name="chevron-forward" size={18} color={palette.muted} />
      </TouchableOpacity>

      {/* Restore purchases */}
      <TouchableOpacity
        style={styles.menuItem}
        onPress={handleRestore}
        disabled={restoring}
        activeOpacity={0.7}
      >
        <View style={styles.menuItemLeft}>
          <Ionicons name="refresh-outline" size={20} color={palette.primary} />
          <View style={styles.menuItemInfo}>
            <Text style={styles.menuItemTitle}>{t('account.restorePurchases')}</Text>
            <Text style={styles.menuItemDesc}>{t('account.restorePurchasesDesc')}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={palette.muted} />
      </TouchableOpacity>

      {/* Display Name */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('account.displayName').toLocaleUpperCase('tr-TR')}</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('account.displayNamePlaceholder')}
          placeholderTextColor={palette.muted}
          maxLength={40}
        />
      </View>

      {/* Avatar Color */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('account.avatarColor').toLocaleUpperCase('tr-TR')}</Text>
        <View style={styles.colorRow}>
          {AVATAR_COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorCircle,
                { backgroundColor: color },
                selectedColor === color && styles.colorSelected,
              ]}
              onPress={() => setSelectedColor(color)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            />
          ))}
        </View>
      </View>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('account.language').toLocaleUpperCase('tr-TR')}</Text>
        <View style={styles.languageRow}>
          {(['tr', 'en'] as const).map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.languageButton,
                language === lang && styles.languageSelected,
              ]}
              onPress={() => setLanguage(lang)}
            >
              <Text
                style={[
                  styles.languageText,
                  language === lang && styles.languageTextSelected,
                ]}
              >
                {lang === 'tr' ? 'Türkçe' : 'English'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Save button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile} activeOpacity={0.9}>
        <LinearGradient
          colors={[Colors.gradientStart, Colors.gradientEnd]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.saveButtonGradient}
        >
          <Text style={styles.saveButtonText}>{t('account.save')}</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={18} color={Colors.debt} />
        <Text style={styles.signOutText}>{t('account.signOut')}</Text>
      </TouchableOpacity>

    </ScrollView>
    <Toast
      message={toast.message}
      type={toast.type}
      visible={toast.visible}
      onHide={hideToast}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  headerGradient: { alignItems: 'center', paddingTop: 60, paddingBottom: Spacing.xl, marginBottom: Spacing.lg, borderRadius: Radius.xl },
  headerName: { fontFamily: Typography.fontDisplayMedium, fontSize: Typography.size.lg, color: '#FFFFFF', marginTop: Spacing.sm },
  proPill: { marginTop: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full },
  proPillActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  proPillFree: { backgroundColor: 'rgba(255,255,255,0.15)' },
  proPillText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.xs },
  proPillTextActive: { color: '#FFFFFF' },
  proPillTextFree: { color: 'rgba(255,255,255,0.85)' },

  // Pro section
  proSection: { marginBottom: spacing.lg },
  sectionLabel: {
    fontSize: fontSizes.sm, fontWeight: '600', color: palette.textSecondary,
    marginBottom: spacing.sm, letterSpacing: 0.5,
  },
  proActiveCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: palette.success + '10',
    borderRadius: radii.lg, padding: spacing.md,
    borderWidth: 1, borderColor: palette.success + '30',
  },
  proActiveInfo: { flex: 1 },
  proActiveTitle: { fontSize: fontSizes.md, fontWeight: '700', color: palette.success },
  proActiveDesc: { fontSize: fontSizes.sm, color: palette.textSecondary, marginTop: 2 },
  freeCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg, padding: spacing.md,
    borderWidth: 1, borderColor: palette.border,
  },
  freeInfo: { marginBottom: spacing.md },
  freeTitle: { fontSize: fontSizes.md, fontWeight: '600', color: palette.text },
  freeDesc: { fontSize: fontSizes.sm, color: palette.textSecondary, marginTop: 2 },
  goProButton: {
    backgroundColor: palette.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  goProButtonText: { fontSize: fontSizes.sm, fontWeight: '700', color: 'white' },

  // Menu items (dashboard, restore)
  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: palette.border,
    minHeight: minTouchTarget,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  menuItemInfo: { flex: 1 },
  menuItemTitle: { fontSize: fontSizes.md, fontWeight: '600', color: palette.text },
  menuItemDesc: { fontSize: fontSizes.xs, color: palette.textSecondary, marginTop: 2 },

  section: { marginBottom: spacing.lg },
  label: {
    fontSize: fontSizes.sm, fontWeight: '600', color: palette.textSecondary,
    marginBottom: spacing.sm, letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1, borderColor: palette.border, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontSize: fontSizes.md, color: palette.text,
    backgroundColor: palette.surface, minHeight: minTouchTarget,
  },
  colorRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  colorCircle: { width: 36, height: 36, borderRadius: radii.full },
  colorSelected: {
    borderWidth: 3, borderColor: palette.text,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 2, elevation: 3,
  },
  languageRow: { flexDirection: 'row', gap: spacing.sm },
  languageButton: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.md, borderWidth: 1, borderColor: palette.border,
    minHeight: minTouchTarget, justifyContent: 'center',
  },
  languageSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  languageText: { fontSize: fontSizes.md, color: palette.text },
  languageTextSelected: { color: palette.background, fontWeight: '600' },
  saveButton: {
    alignSelf: 'stretch', borderRadius: Radius.md, marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center',
    minHeight: 52,
  },
  saveButtonText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.base, color: '#FFFFFF' },
  signOutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md, backgroundColor: Colors.debtLight,
    borderRadius: Radius.md, marginBottom: Spacing.lg,
  },
  signOutText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.base, color: Colors.debt },
});
