import { useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import type { GroupRow } from '@/lib/supabase/types';

export interface ProStatus {
  isUserPro: boolean;
  /** Check if a specific group has Pro (either group purchase or user has User Pro) */
  isGroupPro: (group: Pick<GroupRow, 'is_pro'>) => boolean;
  /** Check if the user has access to Pro features in this group */
  hasProAccess: (group: Pick<GroupRow, 'is_pro'>) => boolean;
}

/**
 * Hook to check Pro status for the current user.
 *
 * Pro access for a group = group.is_pro OR profile.user_pro.
 * User Pro grants Pro access to ALL groups the user is in.
 * Group Pro grants Pro access only for that specific group, to all members.
 */
export function usePro(): ProStatus {
  const { user } = useAuth();

  const isUserPro = user?.user_pro ?? false;

  const isGroupPro = useCallback(
    (group: Pick<GroupRow, 'is_pro'>): boolean => {
      return group.is_pro === true;
    },
    [],
  );

  const hasProAccess = useCallback(
    (group: Pick<GroupRow, 'is_pro'>): boolean => {
      return isUserPro || group.is_pro === true;
    },
    [isUserPro],
  );

  return { isUserPro, isGroupPro, hasProAccess };
}
