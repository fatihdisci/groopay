// ──────────────────────────────────────
// Database types — build-spec Section 1 schema ile uyumlu
// ──────────────────────────────────────

export type MemberRole = 'founder' | 'member';
export type SettlementStatus = 'pending' | 'confirmed' | 'rejected';
export type SplitType = 'equal' | 'custom' | 'subset';

export interface ProfileRow {
  id: string;
  display_name: string;
  avatar_color: string;
  locale: string;
  preferred_currency: string | null;
  expo_push_token: string | null;
  user_pro: boolean;
  user_pro_purchased_at: string | null;
  created_at: string;
}

export interface GroupRow {
  id: string;
  name: string;
  photo_url: string | null;
  base_currency: string;
  created_by: string;
  is_pro: boolean;
  pro_purchased_by: string | null;
  pro_purchased_at: string | null;
  is_demo: boolean;
  archived: boolean;
  description: string | null;
  avatar_emoji: string | null;
  avatar_color: string;
  created_at: string;
}

export interface GroupMemberRow {
  id: string;
  group_id: string;
  user_id: string | null; // NULL = ghost
  display_name: string;
  role: MemberRole;
  is_active: boolean;
  created_at: string;
  joined_at: string | null;
}

export interface GroupInviteRow {
  id: string;
  group_id: string;
  token: string;
  created_by: string;
  expires_at: string | null;
  created_at: string;
}

export interface ExpenseRow {
  id: string;
  group_id: string;
  description: string;
  note: string | null;
  amount: number;
  currency: string;
  category: string;
  split_type: SplitType;
  paid_by: string;
  expense_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ExpenseSplitRow {
  id: string;
  expense_id: string;
  member_id: string;
  share_amount: number;
}

export interface SettlementRow {
  id: string;
  group_id: string;
  from_member: string;
  to_member: string;
  amount: number;
  currency: string;
  status: SettlementStatus;
  marked_by: string;
  confirmed_by: string | null;
  created_at: string;
  confirmed_at: string | null;
  note: string | null;
}

export interface IbanRequestRow {
  id: string;
  group_id: string;
  from_member: string;
  to_member: string;
  status: 'pending' | 'fulfilled' | 'expired';
  created_at: string;
  fulfilled_at: string | null;
  // ⚠️ NO iban field — IBAN is never persisted
}

export interface ActivityLogRow {
  id: string;
  group_id: string;
  actor_member_id: string | null;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── UI-facing composite types ──

export interface GroupWithMembers {
  group: GroupRow;
  members: GroupMemberRow[];
  expenses: ExpenseRow[];
  memberAvatarColors: Record<string, string>; // user_id → avatar_color
}

export interface ExpenseWithSplits {
  expense: ExpenseRow;
  splits: ExpenseSplitRow[];
}

export interface ExpenseFilters {
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  memberId?: string;
}

export interface AllExpensesFilters {
  month?: number;     // 0–11 (JavaScript month index)
  year?: number;
  category?: string;
  currency?: string;
  groupId?: string;
}

export interface ExpenseWithGroupInfo {
  id: string;
  group_id: string;
  group_name: string;
  group_emoji: string | null;
  group_color: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  split_type: SplitType;
  paid_by: string;
  paid_by_name: string;
  expense_date: string;
  created_at: string;
}

export interface AddExpenseInput {
  groupId: string;
  description: string;
  note?: string | null;
  amount: number;
  currency: string;
  category: string;
  splitType: SplitType;
  paidBy: string;
  createdBy: string;
  expenseDate: string;
  splits: { memberId: string; shareAmount: number }[];
}
