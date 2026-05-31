import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addSettlement,
  confirmSettlement,
  rejectSettlement,
  getGroupSettlements,
} from '@/lib/supabase/queries';

export function useGroupSettlements(groupId: string) {
  return useQuery({
    queryKey: ['settlements', groupId],
    queryFn: () => getGroupSettlements(groupId),
    enabled: !!groupId,
    staleTime: 5_000,
  });
}

export function useAddSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof addSettlement>[0]) => addSettlement(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['settlements', variables.groupId] });
      qc.invalidateQueries({ queryKey: ['expenses', variables.groupId] });
      qc.invalidateQueries({ queryKey: ['group', variables.groupId] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

export function useConfirmSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ settlementId, confirmedBy }: { settlementId: string; confirmedBy: string }) =>
      confirmSettlement(settlementId, confirmedBy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlements'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['group'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

export function useRejectSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ settlementId, confirmedBy }: { settlementId: string; confirmedBy: string }) =>
      rejectSettlement(settlementId, confirmedBy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlements'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['group'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
