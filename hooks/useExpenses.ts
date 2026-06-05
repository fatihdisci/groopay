import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addExpense,
  updateExpenseWithSplits,
  deleteExpense,
  getExpenses,
  canModifyExpense,
} from '@/lib/supabase/queries';
import { supabase } from '@/lib/supabase/client';
import type { AddExpenseInput, ExpenseFilters } from '@/lib/supabase/types';
import type { ExpenseRow, GroupMemberRow } from '@/lib/supabase/types';

export { canModifyExpense };

export function useExpenses(groupId: string, filters?: ExpenseFilters) {
  return useQuery({
    queryKey: ['expenses', groupId, filters],
    queryFn: () => getExpenses(groupId, filters),
    staleTime: 10_000,
  });
}

export function useAddExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddExpenseInput) => addExpense(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['expenses', variables.groupId] });
      qc.invalidateQueries({ queryKey: ['balances', variables.groupId] });
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['dashboard-hero'] });
      qc.invalidateQueries({ queryKey: ['pro-analytics'] });
      qc.invalidateQueries({ queryKey: ['all-user-expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-filter-options'] });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      expenseId,
      description,
      note,
      amount,
      currency,
      category,
      splitType,
      paidBy,
      actorMemberId,
      expenseDate,
      splits,
    }: {
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
    }) => updateExpenseWithSplits({
      expenseId, description, note, amount, currency, category,
      splitType, paidBy, actorMemberId, expenseDate, splits,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['balances'] });
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['dashboard-hero'] });
      qc.invalidateQueries({ queryKey: ['pro-analytics'] });
      qc.invalidateQueries({ queryKey: ['all-user-expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-filter-options'] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      expenseId,
      actorMemberId,
    }: {
      expenseId: string;
      actorMemberId: string;
    }) => deleteExpense(expenseId, actorMemberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['balances'] });
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['dashboard-hero'] });
      qc.invalidateQueries({ queryKey: ['pro-analytics'] });
      qc.invalidateQueries({ queryKey: ['all-user-expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-filter-options'] });
    },
  });
}

/** Get the current user's member row from active members. Requires userId to match. */
export function getActorMember(
  members: GroupMemberRow[],
  userId?: string | null,
): GroupMemberRow | undefined {
  if (!userId) return undefined;
  return members.find((m) => m.is_active && m.user_id === userId);
}
