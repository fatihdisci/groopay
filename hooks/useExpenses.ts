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
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      expenseId,
      updates,
      splits,
      actorMemberId,
    }: {
      expenseId: string;
      updates: {
        description?: string;
        note?: string | null;
        amount?: number;
        currency?: string;
        category?: string;
        expense_date?: string;
      };
      splits: { memberId: string; shareAmount: number }[];
      actorMemberId: string;
    }) => updateExpenseWithSplits(expenseId, updates, splits, actorMemberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
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
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
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
