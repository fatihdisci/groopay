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
 * Simplified Phase 8: Pro access = profile.user_pro only.
 * Group Pro infrastructure (group.is_pro, purchaseGroupPro, webhook)
 * is kept in code but hidden from UI for potential future use.
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
    (_group?: Pick<GroupRow, 'is_pro'>): boolean => {
      // Phase 8: simplified to User Pro only — group.is_pro infrastructure kept for future use
      return isUserPro;
    },
    [isUserPro],
  );

  return { isUserPro, isGroupPro, hasProAccess };
}
