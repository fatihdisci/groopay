import { supabase } from './client';
import type {
  ProfileRow,
  GroupRow,
  GroupMemberRow,
  ExpenseRow,
  ExpenseSplitRow,
  GroupInviteRow,
  ActivityLogRow,
  GroupWithMembers,
  ExpenseWithSplits,
  ExpenseFilters,
  AllExpensesFilters,
  ExpenseWithGroupInfo,
  AddExpenseInput,
  SettlementRow,
} from './types';

// ── Profiles ──

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data as ProfileRow;
}

export async function updateProfileRow(
  userId: string,
  updates: Partial<Pick<ProfileRow, 'display_name' | 'avatar_color' | 'locale' | 'preferred_currency'>>,
): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProfileRow;
}

// ── Groups ──

export async function getMyGroups(): Promise<GroupWithMembers[]> {
  const { data: memberRows, error: memberError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('is_active', true);
  if (memberError) throw memberError;
  const groupIds = [...new Set((memberRows ?? []).map((m: { group_id: string }) => m.group_id))];
  if (groupIds.length === 0) return [];

  const { data: groups, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds)
    .eq('archived', false)
    .order('created_at', { ascending: false });
  if (groupError) throw groupError;

  const { data: allMembers, error: membersError } = await supabase
    .from('group_members')
    .select('*')
    .in('group_id', groupIds);
  if (membersError) throw membersError;

  const { data: allExpenses, error: expensesError } = await supabase
    .from('expenses')
    .select('*')
    .in('group_id', groupIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (expensesError) throw expensesError;

  // Fetch profile avatar colors for real users across all groups
  const userIds = [...new Set((allMembers ?? []).map((m: GroupMemberRow) => m.user_id).filter(Boolean))] as string[];
  const memberAvatarColors: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles').select('id, avatar_color').in('id', userIds);
    for (const p of (profiles ?? [])) {
      memberAvatarColors[p.id] = p.avatar_color;
    }
  }

  return (groups ?? []).map((g: GroupRow) => ({
    group: g,
    members: (allMembers ?? []).filter((m: GroupMemberRow) => m.group_id === g.id),
    expenses: (allExpenses ?? []).filter((e: ExpenseRow) => e.group_id === g.id),
    memberAvatarColors,
  }));
}

export async function getGroupDetail(groupId: string): Promise<GroupWithMembers> {
  const { data: group, error: gErr } = await supabase
    .from('groups').select('*').eq('id', groupId).single();
  if (gErr || !group) throw gErr ?? new Error('Group not found');

  const { data: members } = await supabase
    .from('group_members').select('*').eq('group_id', groupId).order('created_at');

  // Fetch profile avatar colors for real users
  const userIds = [...new Set((members ?? []).map((m) => m.user_id).filter(Boolean))] as string[];
  let memberAvatarColors: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles').select('id, avatar_color').in('id', userIds);
    for (const p of (profiles ?? [])) {
      memberAvatarColors[p.id] = p.avatar_color;
    }
  }

  const { data: expenses } = await supabase
    .from('expenses').select('*').eq('group_id', groupId).is('deleted_at', null).order('created_at', { ascending: false });

  const membersWithAvatarColors = ((members ?? []) as GroupMemberRow[]).map((member) => ({
    ...member,
    avatar_color: member.user_id ? memberAvatarColors[member.user_id] : undefined,
  }));

  return {
    group: group as GroupRow,
    members: membersWithAvatarColors,
    expenses: (expenses ?? []) as ExpenseRow[],
    memberAvatarColors,
  };
}

export async function createGroup(
  name: string,
  baseCurrency: string,
  _userId: string,       // kept for backward compat — RPC uses auth.uid()
  displayName: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_group_with_limit', {
    p_name: name,
    p_base_currency: baseCurrency,
    p_display_name: displayName,
  });

  if (error) throw error;
  return data as string;
}

export async function updateGroup(
  groupId: string,
  updates: Partial<Pick<GroupRow, 'name' | 'base_currency' | 'archived' | 'description' | 'avatar_emoji' | 'avatar_color'>>,
): Promise<void> {
  const { error } = await supabase.from('groups').update(updates).eq('id', groupId);
  if (error) throw error;
}

export async function archiveGroup(groupId: string): Promise<void> {
  await supabase.from('groups').update({ archived: true }).eq('id', groupId);
  await supabase.from('activity_log').insert({
    group_id: groupId, action_type: 'group_archived',
    target_type: 'group', target_id: groupId, metadata: {},
  });
}

export async function deleteGroupRpc(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_group', { p_group_id: groupId });
  if (error) throw error;
}

export async function removeMemberRpc(groupId: string, memberId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_member', {
    p_group_id: groupId,
    p_member_id: memberId,
  });
  if (error) throw error;
}

export async function transferOwnershipRpc(groupId: string, newFounderMemberId: string): Promise<void> {
  const { error } = await supabase.rpc('transfer_ownership', {
    p_group_id: groupId,
    p_new_founder_member_id: newFounderMemberId,
  });
  if (error) throw error;
}

// ── Members ──

export async function addGhostMember(
  groupId: string, displayName: string, actorMemberId: string,
): Promise<GroupMemberRow> {
  const { data, error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: null, display_name: displayName, role: 'member' })
    .select('*').single();
  if (error || !data) throw error ?? new Error('insert failed');

  await supabase.from('activity_log').insert({
    group_id: groupId, actor_member_id: actorMemberId, action_type: 'member_added',
    target_type: 'member', target_id: data.id,
    metadata: { display_name: displayName, ghost: true },
  });

  return data as GroupMemberRow;
}

export async function deactivateMember(groupId: string, memberId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members').update({ is_active: false }).eq('id', memberId).eq('group_id', groupId);
  if (error) throw error;

  await supabase.from('activity_log').insert({
    group_id: groupId, actor_member_id: memberId, action_type: 'member_deactivated',
    target_type: 'member', target_id: memberId, metadata: {},
  });
}

export async function updateMember(
  memberId: string, updates: Partial<Pick<GroupMemberRow, 'display_name' | 'role'>>,
): Promise<void> {
  const { error } = await supabase
    .from('group_members').update(updates).eq('id', memberId);
  if (error) throw error;
}

// ── Invites ──

export async function createInvite(groupId: string, _createdBy: string): Promise<GroupInviteRow> {
  const { data: token, error } = await supabase.rpc('create_invite', {
    p_group_id: groupId,
  });

  if (error || !token) throw error ?? new Error('create invite failed');

  // Fetch the full invite row for backward compat
  const { data: invite } = await supabase
    .from('group_invites')
    .select('*')
    .eq('token', token as string)
    .single();

  if (!invite) throw new Error('invite created but not found');
  return invite as GroupInviteRow;
}

export async function getGroupInvites(groupId: string): Promise<GroupInviteRow[]> {
  const { data } = await supabase
    .from('group_invites').select('*').eq('group_id', groupId).order('created_at', { ascending: false });
  return (data ?? []) as GroupInviteRow[];
}

export async function getInviteByToken(token: string): Promise<{ token: string; group_id: string; group_name: string; member_count: number } | null> {
  // Uses SECURITY DEFINER RPC to bypass RLS (caller is not yet a member)
  const { data, error } = await supabase
    .rpc('preview_invite', { p_token: token.toUpperCase() });

  if (error || !data || (data as any).error) return null;
  return data as { token: string; group_id: string; group_name: string; member_count: number };
}

// ── Join (Edge Function) ──

export async function joinViaInvite(
  token: string, sessionToken: string,
  options?: { claimGhostMemberId?: string; displayName?: string },
): Promise<{ success: boolean; action: string; groupId: string; groupName: string }> {
  const fnUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/join-via-invite`;
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      token: token.toUpperCase(),
      claimGhostMemberId: options?.claimGhostMemberId,
      displayName: options?.displayName,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? 'join failed');
  return json;
}

// ── Activity ──

export async function getGroupActivity(groupId: string, limit = 20): Promise<ActivityLogRow[]> {
  const { data } = await supabase
    .from('activity_log')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as ActivityLogRow[];
}

// ── Expenses ──

export async function addExpense(input: AddExpenseInput): Promise<string> {
  const { data, error } = await supabase.rpc('add_expense_with_splits', {
    p_group_id: input.groupId,
    p_description: input.description,
    p_note: input.note ?? null,
    p_amount: input.amount,
    p_currency: input.currency,
    p_category: input.category,
    p_split_type: input.splitType,
    p_paid_by: input.paidBy,
    p_created_by: input.createdBy,
    p_expense_date: input.expenseDate,
    p_splits: input.splits.map((s) => ({
      member_id: s.memberId,
      share_amount: s.shareAmount,
    })),
  });

  if (error) throw error;
  return data as string;
}

export async function updateExpenseWithSplits(input: {
  expenseId: string;
  description: string;
  note: string | null;
  amount: number;
  currency: string;
  category: string;
  splitType: string;
  paidBy: string;
  actorMemberId: string;
  expenseDate: string;
  splits: { memberId: string; shareAmount: number }[];
}): Promise<void> {
  const { error } = await supabase.rpc('update_expense_with_splits', {
    p_expense_id: input.expenseId,
    p_description: input.description,
    p_note: input.note ?? null,
    p_amount: input.amount,
    p_currency: input.currency,
    p_category: input.category,
    p_split_type: input.splitType,
    p_paid_by: input.paidBy,
    p_actor_member_id: input.actorMemberId,
    p_expense_date: input.expenseDate,
    p_splits: input.splits.map((s) => ({
      member_id: s.memberId,
      share_amount: s.shareAmount,
    })),
  });

  if (error) throw error;
}

export async function deleteExpense(
  expenseId: string,
  actorMemberId: string,
): Promise<void> {
  const { error } = await supabase.rpc('delete_expense', {
    p_expense_id: expenseId,
    p_actor_member_id: actorMemberId,
  });

  if (error) throw error;
}

/**
 * Check if an actor (group_member) is authorized to modify an expense.
 * Allowed: expense owner (created_by) OR group founder.
 */
export function canModifyExpense(
  expense: ExpenseRow,
  actorMember: GroupMemberRow,
): boolean {
  return (
    expense.created_by === actorMember.id ||
    actorMember.role === 'founder'
  );
}

export async function getExpenses(
  groupId: string,
  filters?: ExpenseFilters,
): Promise<ExpenseWithSplits[]> {
  let query = supabase
    .from('expenses')
    .select('*')
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .order('expense_date', { ascending: false });

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }
  if (filters?.dateFrom) {
    query = query.gte('expense_date', filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte('expense_date', filters.dateTo);
  }
  if (filters?.memberId) {
    query = query.eq('paid_by', filters.memberId);
  }

  const { data: expenses, error } = await query;
  if (error) throw error;
  if (!expenses || expenses.length === 0) return [];

  const expenseIds = (expenses as ExpenseRow[]).map((e) => e.id);
  const { data: splits } = await supabase
    .from('expense_splits')
    .select('*')
    .in('expense_id', expenseIds);

  const splitsByExpense = new Map<string, ExpenseSplitRow[]>();
  for (const s of (splits ?? []) as ExpenseSplitRow[]) {
    const list = splitsByExpense.get(s.expense_id) ?? [];
    list.push(s);
    splitsByExpense.set(s.expense_id, list);
  }

  return (expenses as ExpenseRow[]).map((e) => ({
    expense: e,
    splits: splitsByExpense.get(e.id) ?? [],
  }));
}

// ── Demo Group ──

export async function createDemoGroup(userId: string): Promise<string> {
  const { data: existingGroups } = await supabase
    .from('groups').select('id').eq('created_by', userId).eq('is_demo', true).limit(1);
  if (existingGroups && existingGroups.length > 0) return (existingGroups[0] as GroupRow).id;

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ name: 'Örnek Grup', base_currency: 'TRY', created_by: userId, is_demo: true })
    .select('*').single();
  if (groupError || !group) throw groupError ?? new Error('Failed to create demo group');
  const groupId = (group as GroupRow).id;

  const memberInserts = [
    { group_id: groupId, user_id: userId, display_name: 'Sen', role: 'founder' as const },
    { group_id: groupId, user_id: null, display_name: 'Ali', role: 'member' as const },
    { group_id: groupId, user_id: null, display_name: 'Ayşe', role: 'member' as const },
    { group_id: groupId, user_id: null, display_name: 'Mehmet', role: 'member' as const },
  ];
  const { data: members, error: membersError } = await supabase
    .from('group_members').insert(memberInserts).select('*');
  if (membersError || !members) throw membersError ?? new Error('Failed to create members');
  const memberRows = members as GroupMemberRow[];
  const payerMember = memberRows.find((m) => m.user_id === userId) ?? memberRows[0]!;

  const expensesToInsert = [
    { group_id: groupId, description: 'Market alışverişi', amount: 350.50, currency: 'TRY', category: 'market', split_type: 'equal', paid_by: payerMember.id, created_by: payerMember.id },
    { group_id: groupId, description: 'Fatura ödemesi', amount: 1250.00, currency: 'TRY', category: 'utilities', split_type: 'equal', paid_by: memberRows[1]!.id, created_by: memberRows[1]!.id },
  ];

  for (const exp of expensesToInsert) {
    const { data: expense, error: expError } = await supabase
      .from('expenses').insert(exp).select('*').single();
    if (expError || !expense) throw expError ?? new Error('Failed to create expense');
    const expenseRow = expense as ExpenseRow;
    // Integer split: use kuruş (minor units) for precise division
    const amountMinor = Math.round(exp.amount * 100);
    const baseShare = Math.floor(amountMinor / memberRows.length);
    const remainder = amountMinor - baseShare * memberRows.length;
    const splitInserts = memberRows.map((m, i) => ({
      expense_id: expenseRow.id, member_id: m.id,
      share_amount: +(baseShare + (i === 0 ? remainder : 0)) / 100,
    }));
    await supabase.from('expense_splits').insert(splitInserts);
  }

  return groupId;
}

// ── Settlements ──

export async function addSettlement(input: {
  groupId: string;
  fromMember: string;
  toMember: string;
  amount: number;
  currency: string;
  markedBy: string;
  note?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('add_settlement', {
    p_group_id: input.groupId,
    p_from_member: input.fromMember,
    p_to_member: input.toMember,
    p_amount: input.amount,
    p_currency: input.currency,
    p_marked_by: input.markedBy,
    p_note: input.note ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function confirmSettlement(
  settlementId: string,
  confirmedBy: string,
): Promise<void> {
  const { error } = await supabase.rpc('confirm_settlement', {
    p_settlement_id: settlementId,
    p_confirmed_by: confirmedBy,
  });
  if (error) throw error;
}

export async function rejectSettlement(
  settlementId: string,
  confirmedBy: string,
): Promise<void> {
  const { error } = await supabase.rpc('reject_settlement', {
    p_settlement_id: settlementId,
    p_confirmed_by: confirmedBy,
  });
  if (error) throw error;
}

export async function getGroupSettlements(groupId: string): Promise<SettlementRow[]> {
  const { data } = await supabase
    .from('settlements')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  return (data ?? []) as SettlementRow[];
}

// ── IBAN WhatsApp message generator ──

export function generateIbanRequestMessage(
  requesterName: string,
  groupName: string,
  amountFormatted: string,
  currency: string,
): string {
  return [
    `Merhaba! 👋`,
    `Groopay'deki *${groupName}* grubunda sana *${amountFormatted} ${currency}* borcum var.`,
    `IBAN'ını paylaşır mısın?`,
    `— Groopay`,
  ].join('\n');
}

// ── WhatsApp share text generator ──

export function generateWhatsAppSummary(
  groupName: string,
  balancesByCurrency: Map<string, { currency: string; simplified: { from: string; to: string; amountMinor: number; fromName?: string; toName?: string }[] }>,
  debtorName?: string,
): string {
  const lines: string[] = [];
  lines.push(`📊 ${groupName} — Borç Özeti`);
  lines.push('');

  for (const [, data] of balancesByCurrency) {
    if (data.simplified.length === 0) continue;
    lines.push(`💰 ${data.currency}:`);
    for (const tx of data.simplified) {
      const from = tx.fromName ?? tx.from;
      const to = tx.toName ?? tx.to;
      const amt = (tx.amountMinor / 100).toFixed(2);
      lines.push(`  ${from} → ${to}: ${amt} ${data.currency}`);
    }
    lines.push('');
  }

  if (debtorName) {
    lines.push(`⚠️ Hatırlatma: ${debtorName}, borcunu ödemeyi unutma!`);
  }

  lines.push('— Groopay');
  return lines.join('\n');
}

export async function hasDemoGroup(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('groups').select('id').eq('created_by', userId).eq('is_demo', true).limit(1);
  return (data ?? []).length > 0;
}

// ── User Currencies ──

export async function getUserCurrencies(userId: string): Promise<string[]> {
  const { data: members } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!members || members.length === 0) return ['TRY'];

  const groupIds = members.map((m) => m.group_id);
  const { data: expenses } = await supabase
    .from('expenses')
    .select('currency')
    .in('group_id', groupIds)
    .is('deleted_at', null);

  const currencies = [...new Set((expenses ?? []).map((e) => e.currency))];
  return currencies.length > 0 ? currencies : ['TRY'];
}

// ── Pro Dashboard Analytics ──

export interface DashboardAnalyticsData {
  monthlyTrend: { month: string; total: number }[];
  topCategory: { category: string; total: number } | null;
  mostActiveMonth: string | null;
  trendCurrency: string; // the single currency used for trend/category calculations
  topPayer: { displayName: string; count: number; total: number } | null; // most frequent payer in selected currency
  settlementSummary: { paid: number; received: number } | null; // confirmed settlements in selected currency
}

export async function getProDashboardAnalytics(
  userId: string,
  currency?: string,
): Promise<DashboardAnalyticsData> {
  const { data: members, error: memError } = await supabase
    .from('group_members')
    .select('id, group_id')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (memError || !members || members.length === 0) {
    return { monthlyTrend: [], topCategory: null, mostActiveMonth: null, trendCurrency: currency ?? 'TRY', topPayer: null, settlementSummary: null };
  }

  const myMemberIds = new Set(members.map((m) => m.id));
  const groupIds = members.map((m) => m.group_id);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: expenses, error: expError } = await supabase
    .from('expenses')
    .select('amount, currency, category, created_at, paid_by')
    .in('group_id', groupIds)
    .gte('created_at', sixMonthsAgo.toISOString())
    .is('deleted_at', null);

  if (expError || !expenses) {
    return { monthlyTrend: [], topCategory: null, mostActiveMonth: null, trendCurrency: currency ?? 'TRY', topPayer: null, settlementSummary: null };
  }

  // Use provided currency, or auto-detect dominant (backward compatible)
  const activeCurrency = currency ?? (() => {
    const counts: Record<string, number> = {};
    for (const exp of expenses) {
      counts[exp.currency] = (counts[exp.currency] || 0) + 1;
    }
    let dominant = 'TRY';
    let maxCount = 0;
    for (const [cur, count] of Object.entries(counts)) {
      if (count > maxCount) { maxCount = count; dominant = cur; }
    }
    return dominant;
  })();

  const monthlyTrendMap: Record<string, number> = {};
  const categoryMap: Record<string, number> = {};
  const monthCountMap: Record<string, number> = {};

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthName = d.toLocaleDateString('tr-TR', { month: 'short' });
    monthlyTrendMap[monthName] = 0;
  }

  for (const exp of expenses) {
    const date = new Date(exp.created_at);
    const mName = date.toLocaleDateString('tr-TR', { month: 'short' });

    monthCountMap[mName] = (monthCountMap[mName] || 0) + 1;

    // ONLY include expenses in the active currency — never mix currencies
    if (exp.currency === activeCurrency) {
      const numericAmount = Number(exp.amount);
      monthlyTrendMap[mName] = (monthlyTrendMap[mName] || 0) + numericAmount;
      categoryMap[exp.category] = (categoryMap[exp.category] || 0) + numericAmount;
    }
  }

  let mostActiveMonth: string | null = null;
  let maxMonthCount = 0;
  for (const [m, count] of Object.entries(monthCountMap)) {
    if (count > maxMonthCount) {
      maxMonthCount = count;
      mostActiveMonth = m;
    }
  }

  let topCategory: { category: string; total: number } | null = null;
  let maxCatAmount = 0;
  for (const [cat, tot] of Object.entries(categoryMap)) {
    if (tot > maxCatAmount) {
      maxCatAmount = tot;
      topCategory = { category: cat, total: tot };
    }
  }

  const monthlyTrend = Object.entries(monthlyTrendMap).map(([month, total]) => ({
    month,
    total: Math.round(total),
  }));

  // ── Top Payer: most frequent payer in selected currency ──
  let topPayer: { displayName: string; count: number; total: number } | null = null;

  const payerMap = new Map<string, { count: number; total: number }>();
  for (const exp of expenses) {
    if (exp.currency !== activeCurrency) continue;
    const existing = payerMap.get(exp.paid_by);
    const amount = Number(exp.amount);
    if (existing) {
      existing.count += 1;
      existing.total += amount;
    } else {
      payerMap.set(exp.paid_by, { count: 1, total: amount });
    }
  }

  if (payerMap.size > 0) {
    // Find the payer with the most expenses (tie-break: highest total)
    let bestPayerId = '';
    let bestCount = 0;
    let bestTotal = 0;
    for (const [pid, info] of payerMap) {
      if (info.count > bestCount || (info.count === bestCount && info.total > bestTotal)) {
        bestPayerId = pid;
        bestCount = info.count;
        bestTotal = info.total;
      }
    }

    // Fetch all group members for display-name lookup
    const { data: allMembers } = await supabase
      .from('group_members')
      .select('id, display_name')
      .in('group_id', groupIds);

    const memberNameMap = new Map<string, string>();
    for (const m of (allMembers ?? [])) {
      memberNameMap.set(m.id, m.display_name);
    }

    topPayer = {
      displayName: memberNameMap.get(bestPayerId) ?? '?',
      count: bestCount,
      total: Math.round(bestTotal),
    };
  }

  // ── Settlement Summary: paid vs received in selected currency (confirmed only) ──
  let settlementSummary: { paid: number; received: number } | null = null;

  const { data: settlements } = await supabase
    .from('settlements')
    .select('from_member, to_member, amount, currency')
    .in('group_id', groupIds)
    .eq('status', 'confirmed')
    .eq('currency', activeCurrency);

  if (settlements && settlements.length > 0) {
    let paid = 0;
    let received = 0;
    for (const s of settlements) {
      const amt = Number(s.amount);
      if (myMemberIds.has(s.from_member)) {
        paid += amt;
      }
      if (myMemberIds.has(s.to_member)) {
        received += amt;
      }
    }
    if (paid > 0 || received > 0) {
      settlementSummary = { paid, received };
    }
  }

  return { monthlyTrend, topCategory, mostActiveMonth, trendCurrency: activeCurrency, topPayer, settlementSummary };
}

// ── All User Expenses (Dashboard "Tüm İşlemler") ──

export interface AllExpensesResult {
  expenses: ExpenseWithGroupInfo[];
  hasMore: boolean;
  total: number;
}

export async function getAllUserExpenses(
  userId: string,
  filters: AllExpensesFilters = {},
  page: number = 0,
  pageSize: number = 20,
): Promise<AllExpensesResult> {
  // 1. Get user's active group memberships
  const { data: members } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!members || members.length === 0) {
    return { expenses: [], hasMore: false, total: 0 };
  }

  const groupIds = members.map((m) => m.group_id);

  // 2. Build base query (simple — no embedded joins, they silently fail)
  let query = supabase
    .from('expenses')
    .select('*', { count: 'exact' })
    .in('group_id', groupIds)
    .is('deleted_at', null);

  // 3. Apply filters
  if (filters.groupId) {
    query = query.eq('group_id', filters.groupId);
  }
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.currency) {
    query = query.eq('currency', filters.currency);
  }
  if (filters.year !== undefined && filters.month !== undefined) {
    const startOfMonth = new Date(filters.year, filters.month, 1);
    const endOfMonth = new Date(filters.year, filters.month + 1, 1);
    query = query
      .gte('expense_date', startOfMonth.toISOString().split('T')[0]!)
      .lt('expense_date', endOfMonth.toISOString().split('T')[0]!);
  }

  // 4. Fetch paginated expenses
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data: expenseRows, error, count } = await query
    .order('expense_date', { ascending: false })
    .range(from, to);

  if (error) throw error;

  const rows = (expenseRows ?? []) as any[];
  const total = count ?? 0;

  if (rows.length === 0) {
    return { expenses: [], hasMore: false, total };
  }

  // 5. Batch-fetch group info + paid_by names (avoids broken embedded joins)
  const uniqueGroupIds = [...new Set(rows.map((r) => r.group_id))] as string[];
  const uniquePaidByIds = [...new Set(rows.map((r) => r.paid_by))] as string[];

  const [{ data: groupsData }, { data: membersData }] = await Promise.all([
    supabase.from('groups').select('id, name, avatar_emoji, avatar_color').in('id', uniqueGroupIds),
    supabase.from('group_members').select('id, display_name').in('id', uniquePaidByIds),
  ]);

  const groupMap = new Map((groupsData ?? []).map((g: any) => [g.id, g]));
  const memberMap = new Map((membersData ?? []).map((m: any) => [m.id, m]));

  // 6. Map to ExpenseWithGroupInfo
  const expenses: ExpenseWithGroupInfo[] = rows.map((row: any) => {
    const group = groupMap.get(row.group_id);
    const payer = memberMap.get(row.paid_by);
    return {
      id: row.id,
      group_id: row.group_id,
      group_name: group?.name ?? '?',
      group_emoji: group?.avatar_emoji ?? null,
      group_color: group?.avatar_color ?? '#4F46E5',
      description: row.description,
      amount: Number(row.amount),
      currency: row.currency,
      category: row.category,
      split_type: row.split_type,
      paid_by: row.paid_by,
      paid_by_name: payer?.display_name ?? '?',
      expense_date: row.expense_date,
      created_at: row.created_at,
    };
  });

  const hasMore = from + expenses.length < total;

  return { expenses, hasMore, total };
}

// ── User Groups + Currencies (for filters) ──

export async function getUserFilterOptions(
  userId: string,
): Promise<{ groups: { id: string; name: string; emoji: string | null; color: string }[]; currencies: string[] }> {
  // Get groups
  const { data: members } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!members || members.length === 0) {
    return { groups: [], currencies: [] };
  }

  const groupIds = members.map((m) => m.group_id);

  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, avatar_emoji, avatar_color')
    .in('id', groupIds)
    .eq('archived', false)
    .order('name');

  // Get unique currencies from expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('currency')
    .in('group_id', groupIds)
    .is('deleted_at', null);

  const currencies = [...new Set((expenses ?? []).map((e) => e.currency))].sort();

  return {
    groups: (groups ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      emoji: g.avatar_emoji,
      color: g.avatar_color,
    })),
    currencies,
  };
}
