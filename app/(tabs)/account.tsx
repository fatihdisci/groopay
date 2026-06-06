import { useState, useCallback, useRef, useLayoutEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRouter } from 'expo-router';
import { useQueryClient, useQuery } from '@tanstack/react-query';

import { useAuth, AVATAR_COLORS } from '@/lib/auth';
import { getAvatarHeaderGradient } from '@/constants/avatarColors';
import { usePro } from '@/hooks/usePro';
import { isRevenueCatAvailable, restorePurchases } from '@/lib/revenuecat';
import { supabase, getSupabaseAccessToken } from '@/lib/supabase/client';
import { getUserCurrencies } from '@/lib/supabase/queries';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { palette, spacing, fontSizes, radii, minTouchTarget } from '@/constants/theme';
import i18n from '@/lib/i18n';
import Toast, { ToastType } from '@/components/Toast';
import Avatar from '@/components/Avatar';
import TipsButton from '@/components/TipsButton';

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
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [selectedColor, setSelectedColor] = useState(user?.avatar_color ?? AVATAR_COLORS[0]!);
  const [language, setLanguage] = useState(user?.locale ?? 'tr');
  const [preferredCurrency, setPreferredCurrency] = useState<string | null>(user?.preferred_currency ?? null);
  const [restoring, setRestoring] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({ visible: false, message: '', type: 'success' });

  const scrollRef = useRef<ScrollView>(null);
  const displayNameY = useRef(0);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ marginRight: 8 }}>
          <TipsButton
            title={t('tips.account.title')}
            tips={[
              { icon: 'person-circle-outline' as const, text: t('tips.account.tip1') },
              { icon: 'color-palette-outline' as const, text: t('tips.account.tip2') },
              { icon: 'language-outline' as const, text: t('tips.account.tip3') },
              { icon: 'cash-outline' as const, text: t('tips.account.tip4') },
            ]}
          />
        </View>
      ),
    });
  }, [navigation, t]);

  const handleDisplayNameFocus = () => {
    // Scroll input into view above keyboard
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, displayNameY.current - 40), animated: true });
    }, 350);
  };

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ visible: true, message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  // Fetch user's used currencies for the selector
  const { data: userCurrencies } = useQuery({
    queryKey: ['user-currencies', user?.id],
    queryFn: () => getUserCurrencies(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      await updateProfile({
        display_name: displayName.trim() || user.display_name,
        avatar_color: selectedColor,
        locale: language,
        preferred_currency: preferredCurrency,
      });
      await i18n.changeLanguage(language);
      // Invalidate group + activity queries so name/color changes propagate
      queryClient.invalidateQueries({ queryKey: ['group'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith('activity') });
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

  const handleDevTogglePro = async () => {
    if (!user) return;
    const newVal = !isUserPro;
    const { error } = await supabase
      .from('profiles')
      .update({ user_pro: newVal })
      .eq('id', user.id);
    if (error) {
      Alert.alert('DEV Hatası', error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    // refreshSession() unavailable in accessToken mode — query invalidation is enough
    showToast(
      newVal ? '🛠 [DEV] Pro AÇIK — sayfayı yenileyin' : '🛠 [DEV] Pro KAPALI',
      'info',
    );
  };

  // ── Export Data ──
  const handleExportData = async () => {
    if (!user) return;
    try {
      const [{ data: profiles }, { data: members }, { data: myGroups }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('group_members').select('*, groups:groups(*)').eq('user_id', user.id),
        supabase.from('groups').select('*').eq('created_by', user.id),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        profile: profiles,
        memberships: members,
        createdGroups: myGroups,
      };

      await Share.share({
        message: JSON.stringify(exportData, null, 2),
        title: 'Groopay Verilerim',
      });
    } catch (e: any) {
      showToast(t('account.exportError'), 'error');
    }
  };

  // ── Delete Account Flow ──
  const [deleteStep, setDeleteStep] = useState<'none' | 'confirm1' | 'confirm2'>('none');
  const [deleteInput, setDeleteInput] = useState('');

  const handleDeleteAccount = async () => {
    if (!user) return;

    // Check founder groups with other real members
    try {
      const { data: founderGroups } = await supabase
        .from('groups')
        .select('id, name')
        .eq('created_by', user.id);

      if (founderGroups && founderGroups.length > 0) {
        // Check which groups have other real members
        const groupIds = founderGroups.map((g: any) => g.id);
        const { data: otherMembers } = await supabase
          .from('group_members')
          .select('group_id, user_id')
          .in('group_id', groupIds)
          .eq('is_active', true)
          .neq('user_id', user.id)
          .not('user_id', 'is', null);

        if (otherMembers && otherMembers.length > 0) {
          const blockedGroupIds = [...new Set(otherMembers.map((m: any) => m.group_id))];
          const blockedNames = founderGroups
            .filter((g: any) => blockedGroupIds.includes(g.id))
            .map((g: any) => g.name)
            .join(', ');

          Alert.alert(
            t('account.founderGroupsBlockTitle'),
            t('account.founderGroupsBlock', { groups: blockedNames }),
            [{ text: t('account.ok'), style: 'default' }],
          );
          return;
        }
      }
    } catch (_) {
      // If check fails, proceed anyway — server will also validate
    }

    // First confirmation
    setDeleteStep('confirm1');
  };

  const confirmDeleteStep1 = () => {
    setDeleteStep('confirm2');
    setDeleteInput('');
  };

  const executeDeleteAccount = async () => {
    if (!user) return;
    try {
      // accessToken mode: get token from module-level holder (NOT getSession)
      const token = getSupabaseAccessToken();
      if (!token) {
        showToast(t('account.deleteError'), 'error');
        return;
      }

      const fnUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.error === 'FOUNDER_GROUPS_EXIST') {
          Alert.alert(t('account.founderGroupsBlockTitle'), json.message);
        } else {
          showToast(json.message ?? t('account.deleteError'), 'error');
        }
        setDeleteStep('none');
        return;
      }

      await signOut();
      queryClient.clear();
      router.replace('/(auth)/sign-in');
    } catch (e: any) {
      showToast(t('account.deleteError'), 'error');
      setDeleteStep('none');
    }
  };

  if (!user) return null;

  const initials = getInitials(displayName || user.display_name);

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── AVATAR HERO ── */}
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

      {/* ── PROFİL ── */}
      <Text style={styles.sectionHeader}>{t('account.sectionProfile')}</Text>

      {/* Display Name */}
      <View
        style={styles.section}
        onLayout={(e) => { displayNameY.current = e.nativeEvent.layout.y; }}
      >
        <Text style={styles.label}>{t('account.displayName')}</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          onFocus={handleDisplayNameFocus}
          placeholder={t('account.displayNamePlaceholder')}
          placeholderTextColor={palette.muted}
          maxLength={40}
        />
      </View>

      {/* Avatar Color */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('account.avatarColor')}</Text>
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
              accessibilityRole="radio"
              accessibilityLabel={t('account.colorOption', { color })}
              accessibilityState={{ selected: selectedColor === color }}
            />
          ))}
        </View>
      </View>

      {/* ── TERCİHLER ── */}
      <Text style={styles.sectionHeader}>{t('account.sectionPreferences')}</Text>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('account.language')}</Text>
        <View style={styles.languageRow}>
          {(['tr', 'en'] as const).map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.languageButton,
                language === lang && styles.languageSelected,
              ]}
              onPress={() => setLanguage(lang)}
              accessibilityRole="radio"
              accessibilityLabel={t('account.languageOption', { lang })}
              accessibilityState={{ selected: language === lang }}
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

      {/* Default Currency */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('account.defaultCurrency')}</Text>
        <View style={styles.currencyRow}>
          {(() => {
            const baseOptions = ['TRY', 'USD', 'EUR'];
            const allOptions = [...new Set([...(userCurrencies ?? []), ...baseOptions])];
            const isAuto = preferredCurrency === null;
            return (
              <>
                <TouchableOpacity
                  key="auto"
                  style={[styles.currencyChip, isAuto && styles.currencyChipSelected]}
                  onPress={() => setPreferredCurrency(null)}
                  accessibilityRole="radio"
                  accessibilityLabel={t('account.currencyOption', { currency: t('account.currencyAuto') })}
                  accessibilityState={{ selected: isAuto }}
                >
                  <Text style={[styles.currencyChipText, isAuto && styles.currencyChipTextSelected]}>
                    {t('account.currencyAuto')}
                  </Text>
                </TouchableOpacity>
                {allOptions.map((cur) => {
                  const isSelected = cur === preferredCurrency;
                  return (
                    <TouchableOpacity
                      key={cur}
                      style={[styles.currencyChip, isSelected && styles.currencyChipSelected]}
                      onPress={() => setPreferredCurrency(cur)}
                      accessibilityRole="radio"
                      accessibilityLabel={t('account.currencyOption', { currency: cur })}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text style={[styles.currencyChipText, isSelected && styles.currencyChipTextSelected]}>
                        {cur}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            );
          })()}
        </View>
      </View>

      {/* Save button */}
      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSaveProfile}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={t('account.save')}
      >
        <LinearGradient
          colors={[Colors.gradientStart, Colors.gradientEnd]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.saveButtonGradient}
        >
          <Text style={styles.saveButtonText}>{t('account.save')}</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── ÜYELİK ── */}
      <Text style={styles.sectionHeader}>{t('account.sectionMembership')}</Text>

      {/* Pro Status */}
      <View style={styles.membershipCard}>
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
              accessibilityRole="button"
              accessibilityLabel={t('paywall.title')}
            >
              <Text style={styles.goProButtonText}>{t('account.goPro')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Restore purchases */}
      <TouchableOpacity
        style={styles.menuItem}
        onPress={handleRestore}
        disabled={restoring}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('paywall.restore')}
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

      {/* Spacer */}
      <View style={{ height: 24 }} />

      {/* Sign Out */}
      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('auth.signOut')}
      >
        <Ionicons name="log-out-outline" size={18} color={Colors.debt} />
        <Text style={styles.signOutText}>{t('account.signOut')}</Text>
      </TouchableOpacity>

      {/* DEV-only: Pro toggle — NEVER in production */}
      {__DEV__ && (
        <TouchableOpacity style={styles.devProButton} onPress={handleDevTogglePro} activeOpacity={0.7}>
          <Ionicons name="construct-outline" size={16} color={palette.warning} />
          <Text style={styles.devProButtonText}>
            🛠 [DEV] {isUserPro ? "Pro'yu Kapat" : "Pro'yu Aç"}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── HESAP ── */}
      <Text style={styles.sectionHeader}>{t('account.sectionAccount')}</Text>

      {/* Export Data */}
      <TouchableOpacity
        style={styles.exportButton}
        onPress={handleExportData}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('account.exportData')}
      >
        <Ionicons name="download-outline" size={18} color={Colors.primary} />
        <Text style={styles.exportButtonText}>{t('account.exportData')}</Text>
      </TouchableOpacity>

      {/* Delete Account */}
      <TouchableOpacity
        style={styles.deleteAccountButton}
        onPress={handleDeleteAccount}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('account.deleteAccount')}
      >
        <Ionicons name="trash-outline" size={16} color={Colors.textTertiary} />
        <Text style={styles.deleteAccountText}>{t('account.deleteAccount')}</Text>
      </TouchableOpacity>

      {/* ── YASAL ── */}
      <Text style={styles.sectionHeader}>{t('account.sectionLegal')}</Text>

      <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL('https://groopay.vercel.app/privacy')} activeOpacity={0.7}>
        <View style={styles.menuItemLeft}>
          <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
          <View style={styles.menuItemInfo}>
            <Text style={styles.menuItemTitle}>{t('account.privacyPolicy')}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward-outline" size={18} color={Colors.textTertiary} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL('https://groopay.vercel.app/terms')} activeOpacity={0.7}>
        <View style={styles.menuItemLeft}>
          <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
          <View style={styles.menuItemInfo}>
            <Text style={styles.menuItemTitle}>{t('account.termsOfService')}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward-outline" size={18} color={Colors.textTertiary} />
      </TouchableOpacity>

    </ScrollView>

    {/* ── Delete Account Confirmation Modals ── */}
    {/* Step 1: Initial warning */}
    {deleteStep === 'confirm1' && (
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t('account.deleteAccount')}</Text>
          <Text style={styles.modalSub}>{t('account.deleteWarning')}</Text>
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setDeleteStep('none')}>
              <Text style={styles.modalCancelText}>{t('account.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalConfirm, { backgroundColor: Colors.debt }]} onPress={confirmDeleteStep1}>
              <Text style={styles.modalConfirmText}>{t('account.deleteAccount')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )}

    {/* Step 2: Final confirmation — type SİL */}
    {deleteStep === 'confirm2' && (
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t('account.deleteFinalTitle')}</Text>
          <Text style={styles.modalSub}>{t('account.deleteFinalConfirm')}</Text>
          <Text style={styles.typeHint}>{t('account.typeSil')}</Text>
          <TextInput
            style={styles.modalInput}
            value={deleteInput}
            onChangeText={setDeleteInput}
            placeholder="SİL"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="characters"
            autoFocus
          />
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setDeleteStep('none')}>
              <Text style={styles.modalCancelText}>{t('account.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalConfirm, { backgroundColor: deleteInput === 'SİL' ? Colors.debt : Colors.textTertiary }]}
              onPress={executeDeleteAccount}
              disabled={deleteInput !== 'SİL'}
            >
              <Text style={styles.modalConfirmText}>{t('account.deleteAccount')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )}
    <Toast
      message={toast.message}
      type={toast.type}
      visible={toast.visible}
      onHide={hideToast}
    />
    </KeyboardAvoidingView>
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

  // Section headers (PROFİL / TERCİHLER / ÜYELİK / HESAP)
  sectionHeader: {
    fontFamily: Typography.fontBodyBold,
    fontSize: 11,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  // Membership card wrapper
  membershipCard: { marginBottom: Spacing.sm },

  // Pro section (old — keep for compatibility)
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

  section: { marginBottom: spacing.md },
  label: {
    fontFamily: Typography.fontBody,
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
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
  currencyRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  currencyChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.md, borderWidth: 1, borderColor: palette.border,
    minHeight: minTouchTarget, justifyContent: 'center',
  },
  currencyChipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  currencyChipText: { fontSize: fontSizes.md, color: palette.text },
  currencyChipTextSelected: { color: palette.background, fontWeight: '600' },
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
  devProButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.sm, marginBottom: Spacing.lg,
    backgroundColor: palette.warning + '15',
    borderRadius: Radius.md, borderWidth: 1, borderColor: palette.warning + '40',
    borderStyle: 'dashed',
  },
  devProButtonText: { fontSize: fontSizes.sm, color: palette.warning, fontWeight: '600' },
  // Export data
  exportButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  exportButtonText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.sm, color: Colors.primary },
  // Delete account
  deleteAccountButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.sm,
    marginBottom: 40,
  },
  deleteAccountText: { fontFamily: Typography.fontBody, fontSize: Typography.size.xs, color: Colors.textTertiary },
  // Modal
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center',
    alignItems: 'center', padding: spacing.xl, zIndex: 200,
  },
  modalCard: {
    backgroundColor: palette.background, borderRadius: radii.xl,
    padding: spacing.lg, width: '100%', maxWidth: 340,
  },
  modalTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: palette.text, marginBottom: spacing.xs },
  modalSub: { fontSize: fontSizes.sm, color: palette.textSecondary, marginBottom: spacing.md, lineHeight: fontSizes.sm * 1.5 },
  modalInput: {
    borderWidth: 1, borderColor: Colors.debt, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontSize: fontSizes.xl, fontWeight: '800', color: Colors.debt,
    backgroundColor: palette.surface, minHeight: minTouchTarget,
    textAlign: 'center', letterSpacing: 4, marginBottom: spacing.md,
  },
  typeHint: { fontSize: fontSizes.xs, color: Colors.textTertiary, marginBottom: spacing.sm },
  modalBtns: { flexDirection: 'row', gap: spacing.sm },
  modalCancel: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border,
    minHeight: minTouchTarget,
  },
  modalCancelText: { fontSize: fontSizes.md, color: palette.textSecondary, fontWeight: '600' },
  modalConfirm: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md, borderRadius: radii.lg,
    minHeight: minTouchTarget,
  },
  modalConfirmText: { fontSize: fontSizes.md, color: 'white', fontWeight: '700' },
});
