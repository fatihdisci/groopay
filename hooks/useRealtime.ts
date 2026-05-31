import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

/**
 * Subscribe to realtime changes for a group.
 * Invalidates queries when expenses, splits, members, or activity change.
 * Subscription is cleaned up on unmount.
 */
export function useRealtime(groupId: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const handleChange = () => {
      qc.invalidateQueries({ queryKey: ['expenses', groupId] });
      qc.invalidateQueries({ queryKey: ['group', groupId] });
      qc.invalidateQueries({ queryKey: ['activity', groupId] });
    };

    // Channel for this group's changes
    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` },
        handleChange,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expense_splits' },
        () => {
          // Splits don't have group_id directly, so invalidate anyway
          qc.invalidateQueries({ queryKey: ['expenses', groupId] });
          qc.invalidateQueries({ queryKey: ['group', groupId] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_log', filter: `group_id=eq.${groupId}` },
        () => qc.invalidateQueries({ queryKey: ['activity', groupId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` },
        handleChange,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'iban_requests', filter: `group_id=eq.${groupId}` },
        () => qc.invalidateQueries({ queryKey: ['iban_requests', groupId] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, qc]);
}

/**
 * Subscribe to all groups' activity changes (for the global Activity tab).
 * Uses user's member rows to filter relevant groups.
 */
export function useRealtimeAllGroups(memberGroupIds: string[]) {
  const qc = useQueryClient();

  useEffect(() => {
    if (memberGroupIds.length === 0) return;

    const filters = memberGroupIds
      .map((gid) => `group_id=eq.${gid}`)
      .join(',');

    const channel = supabase
      .channel('all-activity')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log', filter: filters },
        () => {
          qc.invalidateQueries({ queryKey: ['activity-all'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberGroupIds, qc]);
}
