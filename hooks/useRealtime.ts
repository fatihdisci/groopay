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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, qc]);
}

/**
 * Subscribe to global changes that can affect list, dashboard, and activity tabs.
 * Caller must pass a memoized group id array to avoid needless resubscribe cycles.
 */
export function useRealtimeAllGroups(memberGroupIds: string[]) {
  const qc = useQueryClient();

  useEffect(() => {
    if (memberGroupIds.length === 0) return;

    const invalidateDashboard = () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['dashboard-hero'] });
      qc.invalidateQueries({ queryKey: ['pro-analytics'] });
      qc.invalidateQueries({ queryKey: ['all-user-expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-filter-options'] });
    };

    const channel = supabase
      .channel('global-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => {
          qc.invalidateQueries({ queryKey: ['groups'] });
          invalidateDashboard();
          qc.invalidateQueries({ queryKey: ['activity-all'] });
          memberGroupIds.forEach((gid) => {
            qc.invalidateQueries({ queryKey: ['expenses', gid] });
            qc.invalidateQueries({ queryKey: ['group', gid] });
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members' },
        () => {
          qc.invalidateQueries({ queryKey: ['groups'] });
          invalidateDashboard();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_log' },
        () => {
          qc.invalidateQueries({ queryKey: ['activity-all'] });
          qc.invalidateQueries({ queryKey: ['activity'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settlements' },
        () => {
          qc.invalidateQueries({ queryKey: ['groups'] });
          invalidateDashboard();
          memberGroupIds.forEach((gid) => {
            qc.invalidateQueries({ queryKey: ['settlements', gid] });
            qc.invalidateQueries({ queryKey: ['expenses', gid] });
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberGroupIds, qc]);
}
