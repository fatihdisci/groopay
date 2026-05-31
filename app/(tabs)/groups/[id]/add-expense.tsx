import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { useAddExpense, useUpdateExpense } from '@/hooks/useExpenses';
import { useFxRate } from '@/hooks/useFxRate';
import {
  toMinor, fromMinor, getDecimals,
  splitEqual, splitCustomAmounts, splitCustomShares, splitSubset,
} from '@/lib/finance';
import { SUPPORTED_CURRENCIES, getCurrencyInfo } from '@/lib/finance/money';
import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '@/lib/finance/categories';
import type { Category } from '@/lib/finance/categories';
import type { SplitEntry } from '@/lib/finance/split';
import type { GroupMemberRow, SplitType, ExpenseRow } from '@/lib/supabase/types';
import { palette, spacing, fontSizes, radii } from '@/constants/theme';

// ── Helpers ──

/** Turkish keyboard sends comma (",") as decimal separator — normalize to "." */
function parseNumericInput(s: string): number {
  const normalized = s.replace(',', '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

/** Top 3 currencies — always visible */
const PRIMARY_CURRENCIES = ['TRY', 'USD', 'EUR'];

export default function AddExpenseScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { data: groupData } = useGroupDetail(id!);
  const addExpenseMutation = useAddExpense();
  const updateExpenseMutation = useUpdateExpense();
  const { user } = useAuth();
  const isEdit = !!expenseId;

  const activeMembers = useMemo(
    () => (groupData?.members ?? []).filter((m: GroupMemberRow) => m.is_active),
    [groupData?.members],
  );

  // Find existing expense if editing
  const existingExpense = useMemo(() => {
    if (!isEdit || !groupData) return null;
    return (groupData.expenses as ExpenseRow[]).find((e: ExpenseRow) => e.id === expenseId) ?? null;
  }, [isEdit, groupData, expenseId]);

  // Form state
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [currency, setCurrency] = useState(groupData?.group.base_currency ?? 'TRY');
  const [category, setCategory] = useState<Category>('other');
  const [paidBy, setPaidBy] = useState<string>(activeMembers[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [showFx, setShowFx] = useState(false);
  const [showAllCurrencies, setShowAllCurrencies] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Pre-fill form when editing existing expense
  useEffect(() => {
    if (!existingExpense || initialized) return;
    const e = existingExpense;
    setDescription(e.description);
    setAmountStr(String(e.amount));
    setCurrency(e.currency);
    setCategory(e.category as Category);
    setPaidBy(e.paid_by);
    setNote(e.note ?? '');
    setSplitType(e.split_type as SplitType);
    setInitialized(true);
  }, [existingExpense, initialized]);

  // For custom amounts: memberId → amount string
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  // For custom shares: memberId → shares number
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  // For subset: which members are included
  const [includedMembers, setIncludedMembers] = useState<Set<string>>(
    new Set(activeMembers.map((m: GroupMemberRow) => m.id)),
  );

  // ── Derived values ──
  const currencyInfo = getCurrencyInfo(currency);
  const groupCurrency = groupData?.group.base_currency ?? 'TRY';
  const showFxToggle = currency !== groupCurrency;
  const amount = parseNumericInput(amountStr);
  const amountMinor = toMinor(amount, currency);
  const decimals = getDecimals(currency);

  // FX rate (display-only)
  const { data: fxData } = useFxRate(currency, groupCurrency);
  const fxApprox = showFx && fxData?.rate ? (amount * fxData.rate).toFixed(2) : null;

  // ── Split calculation (live preview) ──
  const splitPreview = useMemo((): SplitEntry[] | null => {
    if (amountMinor <= 0 || activeMembers.length === 0) return null;
    try {
      if (splitType === 'equal' || splitType === 'subset') {
        const included = splitType === 'subset'
          ? [...includedMembers]
          : activeMembers.map((m: GroupMemberRow) => m.id);
        if (included.length === 0) return null;
        if (splitType === 'subset') {
          return splitSubset(amountMinor, included, activeMembers.map((m: GroupMemberRow) => m.id), paidBy);
        }
        return splitEqual(amountMinor, included, paidBy);
      }
      if (splitType === 'custom') {
        const entries = activeMembers
          .map((m: GroupMemberRow) => ({
            memberId: m.id,
            amountMinor: toMinor(parseNumericInput(customAmounts[m.id] || '0'), currency),
          }))
          .filter((e) => e.amountMinor > 0);
        if (entries.length === 0) return null;
        return splitCustomAmounts(amountMinor, entries);
      }
    } catch {
      return null;
    }
    return null;
  }, [amountMinor, activeMembers, splitType, includedMembers, paidBy, customAmounts, currency]);

  // Custom amount remaining
  const customTotalMinor = useMemo(() => {
    return activeMembers.reduce((sum, m: GroupMemberRow) => {
      return sum + toMinor(parseNumericInput(customAmounts[m.id] || '0'), currency);
    }, 0);
  }, [activeMembers, customAmounts, currency]);

  const remainingMinor = amountMinor - customTotalMinor;

  // ── Handlers ──
  const toggleMember = useCallback((memberId: string) => {
    setIncludedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId); else next.add(memberId);
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!description.trim()) { Alert.alert('', t('expense.description') + ' gerekli'); return; }
    if (amountMinor <= 0) { Alert.alert('', t('expense.amount') + ' gerekli'); return; }
    if (!paidBy) { Alert.alert('', 'Ödeyen seçilmedi'); return; }

    // Build splits
    let splits: { memberId: string; shareAmount: number }[];

    if (splitType === 'custom') {
      const entries = activeMembers.map((m: GroupMemberRow) => ({
        memberId: m.id,
        amountMinor: toMinor(parseNumericInput(customAmounts[m.id] || '0'), currency),
      }));
      const total = entries.reduce((a, e) => a + e.amountMinor, 0);
      if (total !== amountMinor) {
        Alert.alert('', `Toplam tutar eşleşmiyor. Kalan: ${fromMinor(amountMinor - total, currency)} ${currency}`);
        return;
      }
      splits = entries
        .filter((e) => e.amountMinor > 0)
        .map((e) => ({
          memberId: e.memberId,
          shareAmount: fromMinor(e.amountMinor, currency),
        }));
      // Include zero-share members too
      const hasShare = new Set(splits.map((s) => s.memberId));
      for (const m of activeMembers) {
        if (!hasShare.has(m.id)) {
          splits.push({ memberId: m.id, shareAmount: 0 });
        }
      }
    } else if (splitType === 'subset') {
      const included = [...includedMembers];
      if (included.length === 0) { Alert.alert('', 'En az bir üye seçin'); return; }
      const result = splitSubset(amountMinor, included, activeMembers.map((m: GroupMemberRow) => m.id), paidBy);
      splits = result.map((r) => ({
        memberId: r.memberId,
        shareAmount: fromMinor(r.shareMinor, currency),
      }));
    } else {
      // equal
      const result = splitEqual(amountMinor, activeMembers.map((m: GroupMemberRow) => m.id), paidBy);
      splits = result.map((r) => ({
        memberId: r.memberId,
        shareAmount: fromMinor(r.shareMinor, currency),
      }));
    }

    // Safety: reject absurd amounts (> 10M in any currency)
    if (amount > 10_000_000) {
      Alert.alert('Hata', `Tutar çok büyük: ${amount.toFixed(2)} ${currency}. Lütfen kontrol edin.`);
      return;
    }

    try {
      const actorMember = activeMembers.find((m: GroupMemberRow) => m.user_id && m.user_id === user?.id) ?? activeMembers.find((m: GroupMemberRow) => m.user_id);
      const actorMemberId = actorMember?.id ?? activeMembers[0]!.id;

      if (isEdit && expenseId) {
        console.log('[add-expense] Updating:', { expenseId, amount, amountMinor, currency, splitCount: splits.length });
        await updateExpenseMutation.mutateAsync({
          expenseId,
          updates: {
            description: description.trim(),
            note: note.trim() || null,
            amount,
            currency,
            category,
            expense_date: new Date().toISOString().slice(0, 10),
          },
          splits,
          actorMemberId,
        });
      } else {
        console.log('[add-expense] Saving:', { amount, amountMinor, currency, splitType, splitCount: splits.length });
        await addExpenseMutation.mutateAsync({
          groupId: id!,
          description: description.trim(),
          note: note.trim() || null,
          amount,
          currency,
          category,
          splitType,
          paidBy,
          createdBy: actorMemberId,
          expenseDate: new Date().toISOString().slice(0, 10),
          splits,
        });
      }
      router.back();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Kayıt başarısız';
      Alert.alert('Hata', message);
    }
  };

  // ── Render helpers ──
  const renderMemberRow = (member: GroupMemberRow, splitInfo?: SplitEntry) => {
    const isGhost = !member.user_id;
    const shareStr = splitInfo ? `${fromMinor(splitInfo.shareMinor, currency).toFixed(decimals)} ${currency}` : '';

    return (
      <View key={member.id} style={styles.memberRow}>
        <View style={styles.memberInfo}>
          <View style={[styles.memberDot, { backgroundColor: isGhost ? palette.muted : palette.primary }]} />
          <Text style={styles.memberName}>{member.display_name}</Text>
          {isGhost && <Ionicons name="person-outline" size={12} color={palette.muted} />}
        </View>

        {splitType === 'equal' && (
          <Switch
            value={true}
            onValueChange={() => {}} // equal→subset handled via split type switch
            trackColor={{ true: palette.primary, false: palette.border }}
            disabled
          />
        )}

        {splitType === 'subset' && (
          <Switch
            value={includedMembers.has(member.id)}
            onValueChange={() => toggleMember(member.id)}
            trackColor={{ true: palette.primary, false: palette.border }}
          />
        )}

        {splitType === 'custom' && (
          <TextInput
            style={styles.customInput}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={palette.muted}
            value={customAmounts[member.id] ?? ''}
            onChangeText={(v) => setCustomAmounts((prev) => ({ ...prev, [member.id]: v }))}
          />
        )}

        {splitPreview && (
          <Text style={styles.sharePreview}>{shareStr}</Text>
        )}
      </View>
    );
  };

  if (!groupData) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={palette.primary} /></View>;
  }

  const isPending = addExpenseMutation.isPending || updateExpenseMutation.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <Stack.Screen options={{ title: isEdit ? t('expense.editTitle') : t('expense.addTitle') }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Description */}
        <Text style={styles.label}>{t('expense.description')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('expense.descriptionPlaceholder')}
          placeholderTextColor={palette.muted}
          value={description}
          onChangeText={setDescription}
        />

        {/* Amount + Currency */}
        <Text style={styles.label}>{t('expense.amount')}</Text>
        <TextInput
          style={styles.amountField}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor={palette.muted}
          value={amountStr}
          onChangeText={setAmountStr}
        />
        {/* Currency chips: top 3 always visible, rest under "Diğer" */}
        <View style={styles.currencyRow}>
          {PRIMARY_CURRENCIES.map((code) => {
            const info = getCurrencyInfo(code);
            const active = currency === code;
            return (
              <TouchableOpacity
                key={code}
                style={[styles.currencyChipWide, active && styles.currencyChipActive]}
                onPress={() => setCurrency(code)}
              >
                <Text style={[styles.currencyChipSymbol]}>{info?.symbol ?? code}</Text>
                <Text style={[styles.currencyChipCode, active && styles.currencyChipTextActive]}>
                  {code}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.currencyChipWide, showAllCurrencies && styles.currencyChipActive]}
            onPress={() => setShowAllCurrencies(!showAllCurrencies)}
          >
            <Ionicons
              name={showAllCurrencies ? 'chevron-up-outline' : 'ellipsis-horizontal-outline'}
              size={16}
              color={showAllCurrencies ? 'white' : palette.textSecondary}
            />
            <Text style={[styles.currencyChipCode, showAllCurrencies && styles.currencyChipTextActive]}>
              Diğer
            </Text>
          </TouchableOpacity>
        </View>
        {/* Expanded currency list */}
        {showAllCurrencies && (
          <View style={styles.currencyExpanded}>
            {SUPPORTED_CURRENCIES
              .filter((c) => !PRIMARY_CURRENCIES.includes(c.code))
              .map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.currencyChipWide, currency === c.code && styles.currencyChipActive]}
                  onPress={() => { setCurrency(c.code); setShowAllCurrencies(false); }}
                >
                  <Text style={styles.currencyChipSymbol}>{c.symbol}</Text>
                  <Text style={[styles.currencyChipCode, currency === c.code && styles.currencyChipTextActive]}>
                    {c.code}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
        )}

        {/* FX toggle — display only */}
        {showFxToggle && (
          <TouchableOpacity style={styles.fxToggle} onPress={() => setShowFx(!showFx)}>
            <Ionicons name="swap-horizontal-outline" size={16} color={palette.primary} />
            <Text style={styles.fxToggleText}>
              {showFx ? t('expense.hideTryEquivalent') : t('expense.showTryEquivalent')}
            </Text>
          </TouchableOpacity>
        )}
        {fxApprox && (
          <Text style={styles.fxApproxText}>
            ≈ {fxApprox} {groupCurrency} ({t('expense.fxDisclaimer')})
          </Text>
        )}

        {/* Category */}
        <Text style={styles.label}>{t('expense.category')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, category === cat && { backgroundColor: CATEGORY_COLORS[cat] + '20', borderColor: CATEGORY_COLORS[cat] }]}
              onPress={() => setCategory(cat)}
            >
              <Ionicons
                name={CATEGORY_ICONS[cat] as keyof typeof Ionicons.glyphMap}
                size={16}
                color={category === cat ? CATEGORY_COLORS[cat] : palette.muted}
              />
              <Text style={[styles.categoryChipText, category === cat && { color: CATEGORY_COLORS[cat] }]}>
                {t(`categories.${cat}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Paid by */}
        <Text style={styles.label}>{t('expense.paidBy')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {activeMembers.map((m: GroupMemberRow) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.memberSelectChip, paidBy === m.id && styles.memberSelectActive]}
              onPress={() => setPaidBy(m.id)}
            >
              <Text style={[styles.memberSelectText, paidBy === m.id && styles.memberSelectTextActive]}>
                {m.display_name}
              </Text>
              {!m.user_id && <Ionicons name="person-outline" size={10} color={paidBy === m.id ? palette.primary : palette.muted} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Split type */}
        <Text style={styles.label}>{t('expense.splitType')}</Text>
        <View style={styles.splitTypeRow}>
          {(['equal', 'custom', 'subset'] as SplitType[]).map((st) => (
            <TouchableOpacity
              key={st}
              style={[styles.splitTypeChip, splitType === st && styles.splitTypeChipActive]}
              onPress={() => setSplitType(st)}
            >
              <Ionicons
                name={st === 'equal' ? 'people-outline' : st === 'custom' ? 'calculator-outline' : 'options-outline'}
                size={16}
                color={splitType === st ? 'white' : palette.textSecondary}
              />
              <Text style={[styles.splitTypeText, splitType === st && styles.splitTypeTextActive]}>
                {t(`expense.split${st.charAt(0).toUpperCase() + st.slice(1)}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Split preview */}
        {splitType === 'custom' && (
          <>
            {remainingMinor !== 0 && (
              <View style={[styles.remainingBar, remainingMinor < 0 ? styles.remainingBarError : styles.remainingBarOk]}>
                <Text style={styles.remainingText}>
                  {t('expense.remaining')}: {fromMinor(remainingMinor, currency).toFixed(decimals)} {currency}
                </Text>
              </View>
            )}
            {remainingMinor > 0 && (() => {
              const emptyMembers = activeMembers.filter((m: GroupMemberRow) => !customAmounts[m.id] || parseFloat(customAmounts[m.id]!.replace(',', '.')) === 0);
              if (emptyMembers.length === 1) {
                return (
                  <TouchableOpacity style={styles.autoFillBtn} onPress={() => {
                    const targetId = emptyMembers[0]!.id;
                    setCustomAmounts((prev) => ({ ...prev, [targetId]: fromMinor(remainingMinor, currency).toFixed(decimals) }));
                  }}>
                    <Ionicons name="sparkles-outline" size={14} color={palette.primary} />
                    <Text style={styles.autoFillText}>{t('expense.autoFill', { name: emptyMembers[0]!.display_name })}</Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })()}
          </>
        )}

        {/* Members list with split info */}
        <Text style={styles.label}>{t('expense.splitPreview')}</Text>
        {activeMembers.map((m: GroupMemberRow) => {
          const splitInfo = splitPreview?.find((s) => s.memberId === m.id);
          return renderMemberRow(m, splitInfo);
        })}

        {/* Note */}
        <Text style={styles.label}>{t('expense.note')}</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          placeholder={t('expense.notePlaceholder')}
          placeholderTextColor={palette.muted}
          value={note}
          onChangeText={setNote}
          multiline
        />

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, isPending && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isPending}
          activeOpacity={0.8}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="white" />
              <Text style={styles.saveBtnText}>{t('expense.save')}</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.surface },
  container: { flex: 1 },
  content: { padding: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  label: {
    fontSize: fontSizes.sm, fontWeight: '600', color: palette.textSecondary,
    marginBottom: spacing.xs, marginTop: spacing.md,
  },
  input: {
    backgroundColor: palette.background, borderRadius: radii.md, padding: spacing.md,
    fontSize: fontSizes.md, color: palette.text,
    borderWidth: 1, borderColor: palette.border,
  },
  noteInput: { minHeight: 80, textAlignVertical: 'top' },
  amountField: {
    backgroundColor: palette.background, borderRadius: radii.lg,
    padding: spacing.md, fontSize: fontSizes.xxxl, fontWeight: '700',
    color: palette.text, textAlign: 'center',
    borderWidth: 2, borderColor: palette.primary,
    minHeight: 64,
  },
  currencyRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  currencyChipWide: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderRadius: radii.md, borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.background,
  },
  currencyChipActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  currencyChipSymbol: { fontSize: fontSizes.sm },
  currencyChipCode: { fontSize: fontSizes.sm, color: palette.textSecondary, fontWeight: '500' },
  currencyChipTextActive: { color: 'white', fontWeight: '600' },
  currencyExpanded: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs,
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: palette.border,
  },
  fxToggle: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginTop: spacing.sm, paddingVertical: spacing.xs,
  },
  fxToggleText: { fontSize: fontSizes.xs, color: palette.primary },
  fxApproxText: { fontSize: fontSizes.xs, color: palette.muted, fontStyle: 'italic' },
  categoryScroll: { marginBottom: spacing.xs },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.full, borderWidth: 1, borderColor: palette.border,
    marginRight: spacing.xs, backgroundColor: palette.background,
  },
  categoryChipText: { fontSize: fontSizes.sm, color: palette.textSecondary },
  memberSelectChip: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.full, borderWidth: 1, borderColor: palette.border,
    marginRight: spacing.xs, backgroundColor: palette.background,
  },
  memberSelectActive: { backgroundColor: palette.primary + '15', borderColor: palette.primary },
  memberSelectText: { fontSize: fontSizes.sm, color: palette.textSecondary },
  memberSelectTextActive: { color: palette.primary, fontWeight: '600' },
  splitTypeRow: { flexDirection: 'row', gap: spacing.sm },
  splitTypeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    paddingVertical: spacing.sm, borderRadius: radii.md,
    borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background,
  },
  splitTypeChipActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  splitTypeText: { fontSize: fontSizes.sm, color: palette.textSecondary },
  splitTypeTextActive: { color: 'white', fontWeight: '600' },
  remainingBar: { padding: spacing.sm, borderRadius: radii.md, marginTop: spacing.sm },
  remainingBarOk: { backgroundColor: palette.success + '15' },
  remainingBarError: { backgroundColor: palette.danger + '15' },
  remainingText: { fontSize: fontSizes.sm, fontWeight: '600', color: palette.text },
  autoFillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    backgroundColor: palette.primary + '10', borderRadius: radii.md,
    borderWidth: 1, borderColor: palette.primary + '30', borderStyle: 'dashed',
  },
  autoFillText: { fontSize: fontSizes.sm, color: palette.primary, fontWeight: '600' },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.border,
  },
  memberInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  memberDot: { width: 8, height: 8, borderRadius: radii.full },
  memberName: { fontSize: fontSizes.sm, color: palette.text },
  customInput: {
    width: 80, textAlign: 'right', borderWidth: 1, borderColor: palette.border,
    borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    fontSize: fontSizes.sm, color: palette.text,
  },
  sharePreview: {
    width: 80, textAlign: 'right', fontSize: fontSizes.xs,
    color: palette.primary, fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: palette.primary, borderRadius: radii.lg,
    paddingVertical: spacing.md, marginTop: spacing.xl,
    minHeight: 48,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: fontSizes.md, fontWeight: '700', color: 'white' },
});
