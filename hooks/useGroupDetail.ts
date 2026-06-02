import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getGroupDetail,
  addGhostMember,
  deactivateMember,
  deleteGroupRpc,
  removeMemberRpc,
  transferOwnershipRpc,
  updateMember,
  createInvite,
  getGroupInvites,
  joinViaInvite,
} from '@/lib/supabase/queries';

export function useGroupDetail(groupId: string) {
  return useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroupDetail(groupId),
    enabled: !!groupId,
  });
}

export function useAddGhostMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ displayName, actorMemberId }: { displayName: string; actorMemberId: string }) =>
      addGhostMember(groupId, displayName, actorMemberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', groupId] });
      qc.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useDeactivateMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => deactivateMember(groupId, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', groupId] });
      qc.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useRemoveMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => removeMemberRpc(groupId, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', groupId] });
      qc.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => deleteGroupRpc(groupId),
    onSuccess: (_data, groupId) => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['group', groupId] });
    },
  });
}

export function useTransferOwnership(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (newFounderMemberId: string) => transferOwnershipRpc(groupId, newFounderMemberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', groupId] });
      qc.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useUpdateMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, updates }: { memberId: string; updates: Parameters<typeof updateMember>[1] }) =>
      updateMember(memberId, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group', groupId] }),
  });
}

export function useCreateInvite(groupId: string) {
  return useMutation({
    mutationFn: (createdBy: string) => createInvite(groupId, createdBy),
  });
}

export function useGroupInvites(groupId: string) {
  return useQuery({
    queryKey: ['invites', groupId],
    queryFn: () => getGroupInvites(groupId),
    enabled: !!groupId,
  });
}

export function useJoinViaInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      token,
      sessionToken,
      options,
    }: {
      token: string;
      sessionToken: string;
      options?: { claimGhostMemberId?: string; displayName?: string };
    }) => joinViaInvite(token, sessionToken, options),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['group'] });
    },
  });
}
