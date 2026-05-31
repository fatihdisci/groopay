import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/lib/auth';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { useAddExpense } from '@/hooks/useExpenses';
import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '@/lib/finance/categories';
import type { Category } from '@/lib/finance/categories';
import type { GroupMemberRow, SplitType } from '@/lib/supabase/types';
import { Colors, Typography, Radius, Shadows } from '@/constants/theme';

const PRIMARY_CURRENCIES = ['TRY', 'USD', 'EUR'];

export default function AddExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { data: groupData } = useGroupDetail(id!);
  const addExpenseMutation = useAddExpense();

  // ── Amount (numpad-driven) ──
  const [amountStr, setAmountStr] = useState('0');
  const [currency, setCurrency] = useState('TRY');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [paidById, setPaidById] = useState<string>('');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [splits, setSplits] = useState<{ memberId: string; shareAmount: number }[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const members = (groupData?.members ?? []) as GroupMemberRow[];
  const activeMembers = members.filter((m) => m.is_active);

  // Auto-select payer as current user
  useEffect(() => {
    if (activeMembers.length > 0 && !paidById) {
      const me = activeMembers.find((m) => m.user_id === user?.id);
      if (me) setPaidById(me.id);
    }
  }, [activeMembers, user?.id, paidById]);

  // ── Numpad handlers ──
  const handleKeyPress = (val: string) => {
    if (val === 'back') {
      setAmountStr((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    } else if (val === '.') {
      if (!amountStr.includes('.')) setAmountStr((prev) => prev + '.');
    } else {
      setAmountStr((prev) => (prev === '0' ? val : prev + val));
    }
  };

  const formatDisplayAmount = () => {
    const num = parseFloat(amountStr) || 0;
    return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getAmountNumber = (): number => {
    return parseFloat(amountStr) || 0;
  };

  // ── Save ──
  const handleSave = async () => {
    const amt = getAmountNumber();
    if (!amt || amt <= 0 || !description.trim() || !paidById) return;
    setSaving(true);
    try {
      const actorMember = activeMembers.find((m) => m.user_id === user?.id);
      if (!actorMember) throw new Error('Üyelik bulunamadı');

      const splitEntries = activeMembers.map((m) => ({
        memberId: m.id,
        shareAmount: Math.round((amt / activeMembers.length) * 100) / 100,
      }));

      await addExpenseMutation.mutateAsync({
        groupId: id!,
        description: description.trim(),
        note: note.trim() || undefined,
        amount: amt,
        currency,
        category,
        splitType,
        paidBy: paidById,
        createdBy: actorMember.id,
        expenseDate: new Date().toISOString().split('T')[0]!,
        splits: splitEntries,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Hata', e?.message ?? 'Masraf eklenemedi');
    } finally {
      setSaving(false);
    }
  };

  const numpadKeys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', 'back'],
  ];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* ── Amount display ── */}
        <View style={styles.amountContainer}>
          <Text style={styles.amountText}>{formatDisplayAmount()}</Text>
          <View style={styles.currencyRow}>
            {PRIMARY_CURRENCIES.map((cur) => (
              <TouchableOpacity
                key={cur}
                onPress={() => setCurrency(cur)}
                style={[styles.currencyPill, currency === cur && styles.currencyPillActive]}
              >
                <Text style={[styles.currencyPillText, currency === cur && styles.currencyPillTextActive]}>{cur}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Quick fields ── */}
        <View style={styles.quickFields}>
          <TouchableOpacity style={styles.quickField} onPress={() => setShowDetails(!showDetails)}>
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
            <Text style={styles.quickFieldText} numberOfLines={1}>
              {description || t('expense.descriptionPlaceholder')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Expanded details ── */}
        {showDetails && (
          <View style={styles.detailsSection}>
            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('expense.description')}</Text>
              <View style={styles.fieldInput}>
                <Text style={styles.fieldInputText}>{description || '—'}</Text>
              </View>
            </View>

            {/* Category */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('expense.category')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[styles.chip, category === cat && { backgroundColor: CATEGORY_COLORS[cat] + '20', borderColor: CATEGORY_COLORS[cat] }]}
                  >
                    <Ionicons name={CATEGORY_ICONS[cat] as any} size={14} color={category === cat ? CATEGORY_COLORS[cat] : Colors.textSecondary} />
                    <Text style={[styles.chipText, category === cat && { color: CATEGORY_COLORS[cat] }]}>{t(`categories.${cat}`)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Payer */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('expense.paidBy')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {activeMembers.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setPaidById(m.id)}
                    style={[styles.chip, paidById === m.id && { backgroundColor: Colors.primary + '15', borderColor: Colors.primary }]}
                  >
                    <Text style={[styles.chipText, paidById === m.id && { color: Colors.primary }]}>{m.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Numpad ── */}
      <View style={styles.numpadContainer}>
        {numpadKeys.map((row, rIndex) => (
          <View key={rIndex} style={styles.numpadRow}>
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                onPress={() => handleKeyPress(key)}
                style={styles.numpadKeyButton}
                activeOpacity={0.6}
              >
                {key === 'back' ? (
                  <Ionicons name="backspace-outline" size={24} color={Colors.textSecondary} />
                ) : (
                  <Text style={styles.numpadKeyText}>{key}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      {/* ── CTA ── */}
      <TouchableOpacity
        onPress={handleSave}
        style={[styles.ctaButton, saving && { opacity: 0.6 }]}
        disabled={saving || getAmountNumber() <= 0}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.ctaButtonText}>{t('expense.save')}</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  amountContainer: { alignItems: 'center', paddingTop: 24, paddingBottom: 12 },
  amountText: { fontFamily: Typography.fontDisplayBold, fontSize: 48, color: Colors.textPrimary, letterSpacing: -1 },
  currencyRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 12 },
  currencyPill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  currencyPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  currencyPillText: { fontFamily: Typography.fontBodyMedium, fontSize: 14, color: Colors.textSecondary },
  currencyPillTextActive: { color: 'white', fontFamily: Typography.fontBodyBold },
  quickFields: { paddingVertical: 8 },
  quickField: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  quickFieldText: { flex: 1, fontFamily: Typography.fontBody, fontSize: 15, color: Colors.textTertiary },
  detailsSection: { paddingTop: 16, gap: 16 },
  field: { marginBottom: 4 },
  fieldLabel: { fontFamily: Typography.fontBodyBold, fontSize: 12, color: Colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 },
  fieldInput: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  fieldInputText: { fontFamily: Typography.fontBody, fontSize: 15, color: Colors.textPrimary },
  chipScroll: { flexDirection: 'row' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, marginRight: 8, backgroundColor: Colors.surface },
  chipText: { fontFamily: Typography.fontBodyMedium, fontSize: 13, color: Colors.textSecondary },
  numpadContainer: { paddingHorizontal: 8, paddingBottom: 12 },
  numpadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  numpadKeyButton: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', marginHorizontal: 6, borderRadius: Radius.md, backgroundColor: Colors.surface },
  numpadKeyText: { fontFamily: Typography.fontDisplayMedium, fontSize: 22, color: Colors.textPrimary },
  ctaButton: { backgroundColor: Colors.primary, marginHorizontal: 24, marginBottom: 34, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...Shadows.md },
  ctaButtonText: { fontFamily: Typography.fontBodyBold, fontSize: 16, color: 'white' },
});
