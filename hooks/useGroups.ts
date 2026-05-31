import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyGroups,
  createGroup,
  updateGroup,
  archiveGroup,
  deleteGroup,
} from '@/lib/supabase/queries';

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: getMyGroups,
    staleTime: 30_000,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, currency, userId, displayName }: { name: string; currency: string; userId: string; displayName: string }) =>
      createGroup(name, currency, userId, displayName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, updates }: { groupId: string; updates: Parameters<typeof updateGroup>[1] }) =>
      updateGroup(groupId, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useArchiveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => archiveGroup(groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => deleteGroup(groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}
