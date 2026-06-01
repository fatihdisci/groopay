import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/lib/auth';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { useAddExpense, useUpdateExpense } from '@/hooks/useExpenses';
import { supabase } from '@/lib/supabase/client';
import { toMinor, fromMinor, getDecimals, SUPPORTED_CURRENCIES, parseMoneyInputToMinor } from '@/lib/finance/money';
import { splitEqual, splitCustomAmounts, splitSubset } from '@/lib/finance/split';
import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '@/lib/finance/categories';
import type { Category } from '@/lib/finance/categories';
import type { GroupMemberRow, SplitType, ExpenseRow, ExpenseSplitRow } from '@/lib/supabase/types';
import { Colors, Typography, Radius, Shadows } from '@/constants/theme';
import TipsButton from '@/components/TipsButton';

const PRIMARY_CURRENCIES = ['TRY', 'USD', 'EUR'];

// ── Simple Calendar (no native dependency) ──

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  // 0 = Sunday, …, 6 = Saturday → convert to 0 = Monday
  const jsDay = new Date(year, month, 1).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function formatDateYMD(y: number, m: number, d: number): string {
  const mm = String(m + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function parseYMD(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y!, month: (m ?? 1) - 1, day: d ?? 1 };
}

const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const MONTH_NAMES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ────────────────────────────────────
// Component
// ────────────────────────────────────

export default function AddExpenseScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId?: string }>();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { data: groupData } = useGroupDetail(id!);
  const addExpenseMutation = useAddExpense();
  const updateExpenseMutation = useUpdateExpense();

  const isEditMode = !!expenseId;
  const isTR = i18n.language?.startsWith('tr');

  // ── Core state ──
  const [amountStr, setAmountStr] = useState('0');
  const [currency, setCurrency] = useState('TRY');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [paidById, setPaidById] = useState<string>('');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [note, setNote] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]!);
  const [saving, setSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showNumpad, setShowNumpad] = useState(true);

  // ── Custom split state ──
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // ── Subset split state ──
  const [selectedSubsetMembers, setSelectedSubsetMembers] = useState<Set<string>>(new Set());

  // ── Currency modal ──
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  // ── Date picker ──
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());

  // ── Edit mode: loading existing ──
  const [loadingExpense, setLoadingExpense] = useState(false);

  const members = (groupData?.members ?? []) as GroupMemberRow[];
  const activeMembers = members.filter((m) => m.is_active);

  // ── Dynamic title ──
  useEffect(() => {
    navigation.setOptions({
      title: isEditMode ? t('expense.editTitle') : t('expense.addTitle'),
    });
  }, [isEditMode, t, navigation]);

  // ── Tips button in header ──
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TipsButton
          title={t('tips.addExpense.title')}
          tips={[
            { icon: 'cash-outline' as const, text: t('tips.addExpense.tip1') },
            { icon: 'git-branch-outline' as const, text: t('tips.addExpense.tip2') },
            { icon: 'person-outline' as const, text: t('tips.addExpense.tip3') },
            { icon: 'calendar-outline' as const, text: t('tips.addExpense.tip4') },
          ]}
        />
      ),
    });
  }, [navigation, t]);

  // ── Auto-select current user as payer (new mode only) ──
  useEffect(() => {
    if (!isEditMode && activeMembers.length > 0 && !paidById) {
      const me = activeMembers.find((m) => m.user_id === user?.id);
      if (me) setPaidById(me.id);
    }
  }, [activeMembers, user?.id, paidById, isEditMode]);

  // ── Load existing expense for edit mode ──
  useEffect(() => {
    if (!expenseId || !id) return;

    let cancelled = false;
    setLoadingExpense(true);

    (async () => {
      const { data: expense } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', expenseId)
        .single();

      if (cancelled || !expense) {
        if (!cancelled) {
          Alert.alert(t('expense.loadingError'));
          router.back();
        }
        return;
      }

      const exp = expense as ExpenseRow;

      const { data: splits } = await supabase
        .from('expense_splits')
        .select('*')
        .eq('expense_id', expenseId);

      const splitRows = (splits ?? []) as ExpenseSplitRow[];

      if (cancelled) return;

      setAmountStr(String(exp.amount));
      setCurrency(exp.currency);
      setDescription(exp.description);
      setCategory(exp.category as Category);
      setPaidById(exp.paid_by);
      setSplitType(exp.split_type);
      setNote(exp.note ?? '');
      setExpenseDate(exp.expense_date);

      // Restore custom amounts if custom split
      if (exp.split_type === 'custom') {
        const amounts: Record<string, string> = {};
        for (const s of splitRows) {
          amounts[s.member_id] = String(s.share_amount);
        }
        setCustomAmounts(amounts);
      }

      // Restore subset selection if subset split
      if (exp.split_type === 'subset') {
        const selected = new Set(splitRows.filter((s) => s.share_amount > 0).map((s) => s.member_id));
        setSelectedSubsetMembers(selected);
      }

      setLoadingExpense(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [expenseId, id, t, router]);

  // ── Numpad ──
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

  const getAmountNumber = (): number => parseFloat(amountStr) || 0;

  // ── Split preview (live) ──
  const splitPreview = useMemo(() => {
    const amt = getAmountNumber();
    if (!amt || amt <= 0 || activeMembers.length === 0) return null;

    const totalMinor = parseMoneyInputToMinor(amountStr, currency);

    try {
      if (splitType === 'equal') {
        const memberIds = activeMembers.map((m) => m.id);
        const entries = splitEqual(totalMinor, memberIds, paidById || memberIds[0]!);
        return {
          entries: entries.map((e) => ({
            memberId: e.memberId,
            share: fromMinor(e.shareMinor, currency),
            displayName: activeMembers.find((m) => m.id === e.memberId)?.display_name ?? '?',
          })),
          total: amt,
          exact: true,
        };
      }

      if (splitType === 'custom') {
        const entries: { memberId: string; amountMinor: number }[] = [];
        let sumMinor = 0;
        for (const m of activeMembers) {
          const raw = customAmounts[m.id];
          if (!raw) continue; // skip empty
          const minor = parseMoneyInputToMinor(raw, currency);
          entries.push({ memberId: m.id, amountMinor: minor });
          sumMinor += minor;
        }
        const remainingMinor = totalMinor - sumMinor;

        const previewEntries = entries.map((e) => ({
          memberId: e.memberId,
          share: fromMinor(e.amountMinor, currency),
          displayName: activeMembers.find((m) => m.id === e.memberId)?.display_name ?? '?',
        }));

        // Also show members with no amount entered yet
        for (const m of activeMembers) {
          if (!previewEntries.find((pe) => pe.memberId === m.id)) {
            previewEntries.push({ memberId: m.id, share: 0, displayName: m.display_name });
          }
        }

        return {
          entries: previewEntries,
          total: amt,
          remaining: fromMinor(remainingMinor, currency),
          remainingMinor,
          exact: remainingMinor === 0,
          overspent: remainingMinor < 0,
        };
      }

      if (splitType === 'subset') {
        const included = activeMembers.filter((m) => selectedSubsetMembers.has(m.id));
        if (included.length === 0) {
          return { entries: [], total: amt, exact: false, empty: true };
        }
        const includedIds = included.map((m) => m.id);
        const allIds = activeMembers.map((m) => m.id);
        const entries = splitSubset(totalMinor, includedIds, allIds, paidById || allIds[0]!);
        return {
          entries: entries.map((e) => ({
            memberId: e.memberId,
            share: fromMinor(e.shareMinor, currency),
            displayName: activeMembers.find((m) => m.id === e.memberId)?.display_name ?? '?',
          })),
          total: amt,
          exact: true,
        };
      }
    } catch {
      return null;
    }

    return null;
  }, [amountStr, currency, splitType, activeMembers, paidById, customAmounts, selectedSubsetMembers]);

  // ── Save ──
  const handleSave = async () => {
    const amt = getAmountNumber();
    if (!amt || amt <= 0 || !description.trim() || !paidById) return;
    setSaving(true);
    try {
      const actorMember = activeMembers.find((m) => m.user_id === user?.id);
      if (!actorMember) throw new Error('Üyelik bulunamadı');

      const totalMinor = parseMoneyInputToMinor(amountStr, currency);
      const memberIds = activeMembers.map((m) => m.id);

      let splitEntries: { memberId: string; shareMinor: number }[];

      if (splitType === 'equal') {
        splitEntries = splitEqual(totalMinor, memberIds, paidById);
      } else if (splitType === 'custom') {
        // Build entries from customAmounts state (string→minor, float-free)
        const customEntries: { memberId: string; amountMinor: number }[] = [];
        for (const m of activeMembers) {
          const raw = customAmounts[m.id];
          if (raw) {
            const minor = parseMoneyInputToMinor(raw, currency);
            if (minor > 0) {
              customEntries.push({ memberId: m.id, amountMinor: minor });
            }
          }
        }
        splitEntries = splitCustomAmounts(totalMinor, customEntries);
      } else if (splitType === 'subset') {
        const includedIds = activeMembers.filter((m) => selectedSubsetMembers.has(m.id)).map((m) => m.id);
        if (includedIds.length === 0) {
          Alert.alert(t('expense.splitType'), t('expense.selectedMembers'));
          setSaving(false);
          return;
        }
        splitEntries = splitSubset(totalMinor, includedIds, memberIds, paidById);
      } else {
        // Fallback (should not happen)
        splitEntries = splitEqual(totalMinor, memberIds, paidById);
      }

      if (isEditMode && expenseId) {
        await updateExpenseMutation.mutateAsync({
          expenseId,
          description: description.trim(),
          note: note.trim() || null,
          amount: amt,
          currency,
          category,
          splitType,
          paidBy: paidById,
          actorMemberId: actorMember.id,
          expenseDate,
          splits: splitEntries.map((s) => ({
            memberId: s.memberId,
            shareAmount: fromMinor(s.shareMinor, currency),
          })),
        });
      } else {
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
          expenseDate: expenseDate,
          splits: splitEntries.map((s) => ({
            memberId: s.memberId,
            shareAmount: fromMinor(s.shareMinor, currency),
          })),
        });
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Hata', e?.message ?? 'Masraf eklenemedi');
    } finally {
      setSaving(false);
    }
  };

  // ── Date picker helpers ──
  const openDatePicker = () => {
    const { year, month } = parseYMD(expenseDate);
    setPickerYear(year);
    setPickerMonth(month);
    setShowDatePicker(true);
  };

  const selectDate = (y: number, m: number, d: number) => {
    setExpenseDate(formatDateYMD(y, m, d));
    setShowDatePicker(false);
  };

  const goToToday = () => {
    const now = new Date();
    setExpenseDate(formatDateYMD(now.getFullYear(), now.getMonth(), now.getDate()));
    setShowDatePicker(false);
  };

  const changePickerMonth = (delta: number) => {
    let newMonth = pickerMonth + delta;
    let newYear = pickerYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    setPickerMonth(newMonth);
    setPickerYear(newYear);
  };

  // ── Calendar grid data ──
  const calendarDays = useMemo(() => {
    const today = new Date();
    const daysInMonth = getDaysInMonth(pickerYear, pickerMonth);
    const firstDay = getFirstDayOfMonth(pickerYear, pickerMonth);
    const selected = parseYMD(expenseDate);

    const cells: { day: number; key: string; isToday: boolean; isSelected: boolean; inMonth: boolean }[] = [];

    // Previous month filler
    if (firstDay > 0) {
      const prevMonth = pickerMonth === 0 ? 11 : pickerMonth - 1;
      const prevYear = pickerMonth === 0 ? pickerYear - 1 : pickerYear;
      const prevDays = getDaysInMonth(prevYear, prevMonth);
      for (let i = firstDay - 1; i >= 0; i--) {
        const d = prevDays - i;
        cells.push({
          day: d,
          key: `p-${d}`,
          isToday: false,
          isSelected: selected.year === prevYear && selected.month === prevMonth && selected.day === d,
          inMonth: false,
        });
      }
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        key: `c-${d}`,
        isToday:
          today.getFullYear() === pickerYear &&
          today.getMonth() === pickerMonth &&
          today.getDate() === d,
        isSelected:
          selected.year === pickerYear &&
          selected.month === pickerMonth &&
          selected.day === d,
        inMonth: true,
      });
    }

    // Next month filler
    const remaining = 42 - cells.length; // 6 rows of 7
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        day: d,
        key: `n-${d}`,
        isToday: false,
        isSelected: false,
        inMonth: false,
      });
    }

    return cells;
  }, [pickerYear, pickerMonth, expenseDate]);

  // ── Other helpers ──
  const formatDateDisplay = (dateStr: string) => {
    const { year, month, day } = parseYMD(dateStr);
    const monthName = isTR ? MONTH_NAMES_TR[month]! : MONTH_NAMES_EN[month]!;
    return `${day} ${monthName} ${year}`;
  };

  const findMemberName = (id: string) => activeMembers.find((m) => m.id === id)?.display_name ?? '?';

  const DAY_NAMES = (isTR ? t('expense.days') : 'Mo_Tu_We_Th_Fr_Sa_Su').split('_');

  const numpadKeys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', 'back'],
  ];

  const canSave = getAmountNumber() > 0 && description.trim().length > 0 && !!paidById;

  if (loadingExpense) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* ── Amount display (tap to toggle numpad) ── */}
        <TouchableOpacity
          style={styles.amountContainer}
          onPress={() => setShowNumpad((prev) => !prev)}
          activeOpacity={0.7}
        >
          <Text style={styles.amountText}>{formatDisplayAmount()}</Text>
          {!showNumpad && (
            <View style={styles.numpadHint}>
              <Ionicons name="calculator-outline" size={14} color={Colors.primary} />
              <Text style={styles.numpadHintText}>{t('expense.tapToEdit')}</Text>
            </View>
          )}
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
            <TouchableOpacity
              onPress={() => setShowCurrencyModal(true)}
              style={[styles.currencyPill, !PRIMARY_CURRENCIES.includes(currency) && styles.currencyPillActive]}
            >
              <Text
                style={[
                  styles.currencyPillText,
                  !PRIMARY_CURRENCIES.includes(currency) && styles.currencyPillTextActive,
                ]}
              >
                {PRIMARY_CURRENCIES.includes(currency) ? t('expense.otherCurrency') : currency}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* ── Quick description ── */}
        <View style={styles.quickFields}>
          <TouchableOpacity
            style={styles.quickField}
            onPress={() => {
              if (!showDetails) {
                setShowDetails(true);
                setShowNumpad(false);
              } else {
                setShowDetails(false);
                setShowNumpad(true);
              }
            }}
          >
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
            <Text style={styles.quickFieldText} numberOfLines={1}>
              {description || t('expense.tapToDetails')}
            </Text>
            <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* ── Details ── */}
        {showDetails && (
          <View style={styles.detailsSection}>
            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('expense.description')}</Text>
              <TextInput
                style={styles.fieldInput}
                value={description}
                onChangeText={setDescription}
                placeholder={t('expense.descriptionPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                maxLength={60}
              />
            </View>

            {/* Split Type */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('expense.splitType')}</Text>
              <View style={styles.splitTypeRow}>
                {(['equal', 'custom', 'subset'] as SplitType[]).map((st) => (
                  <TouchableOpacity
                    key={st}
                    onPress={() => setSplitType(st)}
                    style={[styles.splitTypeBtn, splitType === st && styles.splitTypeBtnActive]}
                  >
                    <Text style={[styles.splitTypeBtnText, splitType === st && styles.splitTypeBtnTextActive]}>
                      {st === 'equal' ? t('expense.splitEqual') : st === 'custom' ? t('expense.splitCustom') : t('expense.splitSubset')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Custom amounts per member ── */}
            {splitType === 'custom' && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('expense.splitCustom')}</Text>
                {activeMembers.map((m) => (
                  <View key={m.id} style={styles.customAmountRow}>
                    <Text style={styles.customAmountLabel}>{m.display_name}</Text>
                    <TextInput
                      style={styles.customAmountInput}
                      value={customAmounts[m.id] ?? ''}
                      onChangeText={(val) => {
                        // Allow only digits and one dot
                        const cleaned = val.replace(/[^0-9.]/g, '');
                        setCustomAmounts((prev) => ({ ...prev, [m.id]: cleaned }));
                      }}
                      placeholder="0.00"
                      placeholderTextColor={Colors.textTertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                ))}
                {/* Remaining indicator */}
                {splitPreview && 'remaining' in splitPreview && (
                  <View style={styles.remainingRow}>
                    <Text
                      style={[
                        styles.remainingText,
                        splitPreview.overspent
                          ? styles.remainingOverspent
                          : splitPreview.exact
                            ? styles.remainingExact
                            : null,
                      ]}
                    >
                      {splitPreview.overspent
                        ? t('expense.overspent')
                        : splitPreview.exact
                          ? t('expense.exactMatch')
                          : `${t('expense.remaining')}: ${splitPreview.remaining!.toLocaleString('tr-TR', { minimumFractionDigits: getDecimals(currency), maximumFractionDigits: getDecimals(currency) })}`}
                    </Text>
                    {!splitPreview.exact && !splitPreview.overspent && (
                      <TouchableOpacity
                        onPress={() => {
                          const rem = splitPreview.remaining!;
                          setCustomAmounts((prev) => ({
                            ...prev,
                            [paidById]: String(
                              (parseFloat(prev[paidById] ?? '0') + rem).toFixed(getDecimals(currency)),
                            ),
                          }));
                        }}
                        style={styles.autoFillBtn}
                      >
                        <Text style={styles.autoFillText}>
                          {t('expense.autoFill', { name: findMemberName(paidById) })}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* ── Subset member selection ── */}
            {splitType === 'subset' && (
              <View style={styles.field}>
                <View style={styles.subsetHeader}>
                  <Text style={styles.fieldLabel}>
                    {t('expense.selectedMembers')} ({selectedSubsetMembers.size}/{activeMembers.length})
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (selectedSubsetMembers.size === activeMembers.length) {
                        setSelectedSubsetMembers(new Set());
                      } else {
                        setSelectedSubsetMembers(new Set(activeMembers.map((m) => m.id)));
                      }
                    }}
                  >
                    <Text style={styles.subsetToggleAll}>
                      {selectedSubsetMembers.size === activeMembers.length
                        ? t('expense.deselectAll')
                        : t('expense.selectAll')}
                    </Text>
                  </TouchableOpacity>
                </View>
                {activeMembers.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => {
                      setSelectedSubsetMembers((prev) => {
                        const next = new Set(prev);
                        if (next.has(m.id)) {
                          next.delete(m.id);
                        } else {
                          next.add(m.id);
                        }
                        return next;
                      });
                    }}
                    style={styles.subsetRow}
                  >
                    <Ionicons
                      name={selectedSubsetMembers.has(m.id) ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selectedSubsetMembers.has(m.id) ? Colors.primary : Colors.textTertiary}
                    />
                    <Text style={styles.subsetMemberName}>{m.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Category */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('expense.category')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.chip,
                      category === cat && { backgroundColor: CATEGORY_COLORS[cat] + '20', borderColor: CATEGORY_COLORS[cat] },
                    ]}
                  >
                    <Ionicons
                      name={CATEGORY_ICONS[cat] as any}
                      size={14}
                      color={category === cat ? CATEGORY_COLORS[cat] : Colors.textSecondary}
                    />
                    <Text style={[styles.chipText, category === cat && { color: CATEGORY_COLORS[cat] }]}>
                      {t(`categories.${cat}`)}
                    </Text>
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
                    style={[
                      styles.chip,
                      paidById === m.id && { backgroundColor: Colors.primary + '15', borderColor: Colors.primary },
                    ]}
                  >
                    <Text style={[styles.chipText, paidById === m.id && { color: Colors.primary }]}>
                      {m.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Date */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('expense.date')}</Text>
              <TouchableOpacity style={styles.dateButton} onPress={openDatePicker}>
                <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                <Text style={styles.dateButtonText}>{formatDateDisplay(expenseDate)}</Text>
              </TouchableOpacity>
            </View>

            {/* Note */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('expense.note')}</Text>
              <TextInput
                style={styles.fieldInput}
                value={note}
                onChangeText={setNote}
                placeholder={t('expense.notePlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                maxLength={120}
              />
            </View>

            {/* ── Live preview ── */}
            {splitPreview && splitPreview.entries.length > 0 && !(splitType === 'subset' && 'empty' in splitPreview) && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('expense.splitPreview')}</Text>
                <View style={styles.previewCard}>
                  {splitPreview.entries.map((entry) => (
                    <View key={entry.memberId} style={styles.previewRow}>
                      <Text style={styles.previewName}>{entry.displayName}</Text>
                      <Text style={[styles.previewAmount, entry.share === 0 && styles.previewAmountZero]}>
                        {entry.share.toLocaleString('tr-TR', {
                          minimumFractionDigits: getDecimals(currency),
                          maximumFractionDigits: getDecimals(currency),
                        })}{' '}
                        {currency}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.previewDivider} />
                  <View style={styles.previewRow}>
                    <Text style={styles.previewTotalLabel}>{t('expense.amount')}</Text>
                    <Text style={styles.previewTotal}>
                      {splitPreview.total.toLocaleString('tr-TR', {
                        minimumFractionDigits: getDecimals(currency),
                        maximumFractionDigits: getDecimals(currency),
                      })}{' '}
                      {currency}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Numpad (only when actively entering amount) ── */}
      {showNumpad && (
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
      )}

      {/* ── CTA (always visible) ── */}
      <TouchableOpacity
        onPress={handleSave}
        style={[styles.ctaButton, !canSave && { opacity: 0.6 }]}
        disabled={saving || !canSave}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.ctaButtonText}>{t('expense.save')}</Text>
        )}
      </TouchableOpacity>

      {/* ── Currency Picker Modal ── */}
      <Modal visible={showCurrencyModal} transparent animationType="slide" onRequestClose={() => setShowCurrencyModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('expense.selectCurrency')}</Text>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[...SUPPORTED_CURRENCIES]}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.currencyListItem, currency === item.code && styles.currencyListItemActive]}
                  onPress={() => {
                    setCurrency(item.code);
                    setShowCurrencyModal(false);
                  }}
                >
                  <Text style={styles.currencyListFlag}>{item.flag}</Text>
                  <View style={styles.currencyListInfo}>
                    <Text style={styles.currencyListCode}>{item.code}</Text>
                    <Text style={styles.currencyListLabel}>{item.label}</Text>
                  </View>
                  {currency === item.code && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
                </TouchableOpacity>
              )}
              style={styles.currencyList}
            />
          </View>
        </View>
      </Modal>

      {/* ── Date Picker Modal ── */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerCard}>
            {/* Header */}
            <View style={styles.datePickerHeader}>
              <TouchableOpacity onPress={() => changePickerMonth(-1)} style={styles.datePickerArrow}>
                <Ionicons name="chevron-back" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.datePickerTitle}>
                {isTR ? MONTH_NAMES_TR[pickerMonth] : MONTH_NAMES_EN[pickerMonth]} {pickerYear}
              </Text>
              <TouchableOpacity onPress={() => changePickerMonth(1)} style={styles.datePickerArrow}>
                <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Day names */}
            <View style={styles.datePickerWeekdays}>
              {DAY_NAMES.map((d) => (
                <Text key={d} style={styles.datePickerWeekday}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={styles.datePickerGrid}>
              {calendarDays.map((cell) => (
                <TouchableOpacity
                  key={cell.key}
                  onPress={() => {
                    if (!cell.inMonth) return;
                    selectDate(pickerYear, pickerMonth, cell.day);
                  }}
                  style={[
                    styles.datePickerDay,
                    cell.isToday && styles.datePickerDayToday,
                    cell.isSelected && styles.datePickerDaySelected,
                    !cell.inMonth && styles.datePickerDayOther,
                  ]}
                  disabled={!cell.inMonth}
                >
                  <Text
                    style={[
                      styles.datePickerDayText,
                      cell.isToday && styles.datePickerDayTextToday,
                      cell.isSelected && styles.datePickerDayTextSelected,
                      !cell.inMonth && styles.datePickerDayTextOther,
                    ]}
                  >
                    {cell.day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Footer */}
            <View style={styles.datePickerFooter}>
              <TouchableOpacity onPress={goToToday} style={styles.datePickerFooterBtn}>
                <Text style={styles.datePickerFooterBtnText}>{t('expense.today')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={[styles.datePickerFooterBtn, styles.datePickerFooterBtnClose]}
              >
                <Text style={styles.datePickerFooterBtnTextClose}>{t('expense.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  // Amount
  amountContainer: { alignItems: 'center', paddingTop: 24, paddingBottom: 12 },
  amountText: { fontFamily: Typography.fontDisplayBold, fontSize: 48, color: Colors.textPrimary, letterSpacing: -1 },
  numpadHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, opacity: 0.5 },
  numpadHintText: { fontFamily: Typography.fontBody, fontSize: 12, color: Colors.primary },
  currencyRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  currencyPill: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.full,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  currencyPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  currencyPillText: { fontFamily: Typography.fontBodyMedium, fontSize: 14, color: Colors.textSecondary },
  currencyPillTextActive: { color: 'white', fontFamily: Typography.fontBodyBold },

  // Quick fields
  quickFields: { paddingVertical: 8 },
  quickField: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 16, backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  quickFieldText: { flex: 1, fontFamily: Typography.fontBody, fontSize: 15, color: Colors.textTertiary },

  // Details
  detailsSection: { paddingTop: 16, gap: 16 },
  field: { marginBottom: 4 },
  fieldLabel: {
    fontFamily: Typography.fontBodyBold, fontSize: 12, color: Colors.textSecondary,
    marginBottom: 8, letterSpacing: 0.5,
  },
  fieldInput: {
    paddingVertical: 12, paddingHorizontal: 16, backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    fontFamily: Typography.fontBody, fontSize: 15, color: Colors.textPrimary,
  },

  // Split type
  splitTypeRow: { flexDirection: 'row', gap: 8 },
  splitTypeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, alignItems: 'center',
  },
  splitTypeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  splitTypeBtnText: { fontFamily: Typography.fontBodyMedium, fontSize: 12, color: Colors.textSecondary },
  splitTypeBtnTextActive: { color: 'white', fontFamily: Typography.fontBodyBold },

  // Custom amounts
  customAmountRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: 6,
  },
  customAmountLabel: { fontFamily: Typography.fontBody, fontSize: 14, color: Colors.textPrimary, flex: 1 },
  customAmountInput: {
    fontFamily: Typography.fontBodyMedium, fontSize: 14, color: Colors.textPrimary,
    paddingVertical: 4, paddingHorizontal: 10, backgroundColor: Colors.background,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    minWidth: 80, textAlign: 'right',
  },
  remainingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  remainingText: { fontFamily: Typography.fontBodyMedium, fontSize: 13, color: Colors.textSecondary },
  remainingOverspent: { color: '#EF4444' },
  remainingExact: { color: '#22C55E' },
  autoFillBtn: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: Radius.full,
    backgroundColor: Colors.primary + '15',
  },
  autoFillText: { fontFamily: Typography.fontBodyBold, fontSize: 11, color: Colors.primary },

  // Subset
  subsetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  subsetToggleAll: { fontFamily: Typography.fontBodyMedium, fontSize: 12, color: Colors.primary },
  subsetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12, backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: 6,
  },
  subsetMemberName: { fontFamily: Typography.fontBody, fontSize: 14, color: Colors.textPrimary },

  // Chips
  chipScroll: { flexDirection: 'row' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border, marginRight: 8, backgroundColor: Colors.surface,
  },
  chipText: { fontFamily: Typography.fontBodyMedium, fontSize: 13, color: Colors.textSecondary },

  // Date
  dateButton: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 16, backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  dateButtonText: { fontFamily: Typography.fontBody, fontSize: 15, color: Colors.textPrimary },

  // Preview card
  previewCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: 12,
  },
  previewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
  },
  previewName: { fontFamily: Typography.fontBody, fontSize: 14, color: Colors.textPrimary },
  previewAmount: { fontFamily: Typography.fontBodyMedium, fontSize: 14, color: Colors.textPrimary },
  previewAmountZero: { color: Colors.textTertiary },
  previewDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 6 },
  previewTotalLabel: { fontFamily: Typography.fontBodyBold, fontSize: 14, color: Colors.textSecondary },
  previewTotal: { fontFamily: Typography.fontBodyBold, fontSize: 14, color: Colors.primary },

  // Numpad
  numpadContainer: { paddingHorizontal: 8, paddingBottom: 12 },
  numpadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  numpadKeyButton: {
    flex: 1, height: 56, alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 6, borderRadius: Radius.md, backgroundColor: Colors.surface,
  },
  numpadKeyText: { fontFamily: Typography.fontDisplayMedium, fontSize: 22, color: Colors.textPrimary },

  // CTA
  ctaButton: {
    backgroundColor: Colors.primary, marginHorizontal: 24, marginBottom: 34,
    height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
  },
  ctaButtonText: { fontFamily: Typography.fontBodyBold, fontSize: 16, color: 'white' },

  // Modal shared
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '70%', paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontFamily: Typography.fontDisplayMedium, fontSize: 18, color: Colors.textPrimary },
  modalClose: { padding: 4 },

  // Currency list
  currencyList: { paddingHorizontal: 16, paddingTop: 8 },
  currencyListItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: Radius.md,
  },
  currencyListItemActive: { backgroundColor: Colors.primary + '10' },
  currencyListFlag: { fontSize: 24 },
  currencyListInfo: { flex: 1 },
  currencyListCode: { fontFamily: Typography.fontBodyBold, fontSize: 15, color: Colors.textPrimary },
  currencyListLabel: { fontFamily: Typography.fontBody, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  // Date picker
  datePickerCard: {
    backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  datePickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12,
  },
  datePickerArrow: { padding: 8 },
  datePickerTitle: { fontFamily: Typography.fontDisplayMedium, fontSize: 18, color: Colors.textPrimary },
  datePickerWeekdays: {
    flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8,
  },
  datePickerWeekday: {
    flex: 1, textAlign: 'center',
    fontFamily: Typography.fontBodyBold, fontSize: 11, color: Colors.textTertiary,
  },
  datePickerGrid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8,
  },
  datePickerDay: {
    width: '14.28%' as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
  },
  datePickerDayToday: {
    backgroundColor: Colors.primary + '12', borderRadius: Radius.full,
  },
  datePickerDaySelected: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
  },
  datePickerDayOther: { opacity: 0.3 },
  datePickerDayText: { fontFamily: Typography.fontBody, fontSize: 15, color: Colors.textPrimary },
  datePickerDayTextToday: { fontFamily: Typography.fontBodyBold, color: Colors.primary },
  datePickerDayTextSelected: { color: 'white', fontFamily: Typography.fontBodyBold },
  datePickerDayTextOther: { color: Colors.textTertiary },
  datePickerFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, gap: 12,
  },
  datePickerFooterBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderRadius: Radius.md, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  datePickerFooterBtnClose: { backgroundColor: Colors.primary },
  datePickerFooterBtnText: { fontFamily: Typography.fontBodyBold, fontSize: 14, color: Colors.primary },
  datePickerFooterBtnTextClose: { fontFamily: Typography.fontBodyBold, fontSize: 14, color: 'white' },
});
