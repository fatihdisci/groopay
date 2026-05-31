// ──────────────────────────────────────
// Split calculation — pure functions
// All amounts in integer MINOR UNITS (kuruş).
// SUM of all returned shares MUST equal totalMinor exactly.
// ──────────────────────────────────────

export interface SplitEntry {
  memberId: string;
  shareMinor: number; // integer minor units
}

// ── Helpers ──

function sumMinor(entries: SplitEntry[]): number {
  return entries.reduce((a, e) => a + e.shareMinor, 0);
}

// ── Equal Split ──

/**
 * Split total equally among memberIds.
 * The remainder (due to integer division) is assigned to payerId.
 * If payerId is not in the list, it falls back to the first member.
 */
export function splitEqual(
  totalMinor: number,
  memberIds: string[],
  payerId: string,
): SplitEntry[] {
  if (memberIds.length === 0) {
    throw new Error('At least one member is required for split');
  }
  if (totalMinor < 0) {
    throw new Error('Total amount cannot be negative');
  }

  const base = Math.floor(totalMinor / memberIds.length);
  let remainder = totalMinor - base * memberIds.length;

  // Pay the remainder to the payer if they're in the list, else first member
  const fallbackId = memberIds.includes(payerId) ? payerId : memberIds[0]!;

  const result: SplitEntry[] = memberIds.map((id) => {
    let share = base;
    if (remainder > 0 && id === fallbackId) {
      share += remainder;
      remainder = 0;
    }
    return { memberId: id, shareMinor: share };
  });

  // Safety: verify sum equals total
  if (sumMinor(result) !== totalMinor) {
    throw new Error(
      `Split invariant broken: sum=${sumMinor(result)} expected=${totalMinor}`,
    );
  }

  return result;
}

// ── Custom Amount Split ──

/**
 * Split using explicit amounts per member.
 * Total of all amounts MUST equal totalMinor exactly (0 tolerance).
 */
export function splitCustomAmounts(
  totalMinor: number,
  entries: { memberId: string; amountMinor: number }[],
): SplitEntry[] {
  if (entries.length === 0) {
    throw new Error('At least one entry is required for custom split');
  }

  const result: SplitEntry[] = entries.map((e) => ({
    memberId: e.memberId,
    shareMinor: e.amountMinor,
  }));

  const actual = sumMinor(result);
  if (actual !== totalMinor) {
    throw new Error(
      `Custom amounts sum (${actual}) does not equal total (${totalMinor}). Difference: ${totalMinor - actual}`,
    );
  }

  return result;
}

// ── Custom Shares Split (ratio-based) ──

/**
 * Split total according to share ratios.
 * e.g. totalMinor=10000, shares=[1,2,1] → 2500/5000/2500
 * Remainder (from integer rounding) goes to the largest share holder(s).
 * If tied, goes to the payer; if payer not in list, first of the max-share entries.
 */
export function splitCustomShares(
  totalMinor: number,
  entries: { memberId: string; shares: number }[],
  payerId: string,
): SplitEntry[] {
  if (entries.length === 0) {
    throw new Error('At least one entry is required for share split');
  }
  if (totalMinor < 0) {
    throw new Error('Total amount cannot be negative');
  }

  const totalShares = entries.reduce((a, e) => a + e.shares, 0);
  if (totalShares <= 0) {
    throw new Error('Total shares must be positive');
  }

  let assigned = 0;
  const result: SplitEntry[] = entries.map((e) => {
    // Proportional share, floor to avoid overshoot
    const share = Math.floor((e.shares / totalShares) * totalMinor);
    assigned += share;
    return { memberId: e.memberId, shareMinor: share };
  });

  // Distribute remainder to entries with largest shares (descending by shares, then by assigned)
  let remainder = totalMinor - assigned;

  if (remainder > 0) {
    // Sort by shares descending; if tie, prefer payer
    const sorted = [...result]
      .map((r, i) => ({ ...r, idx: i, shares: entries[i]!.shares }))
      .sort((a, b) => {
        if (b.shares !== a.shares) return b.shares - a.shares;
        // Tie: prefer payer
        if (a.memberId === payerId) return -1;
        if (b.memberId === payerId) return 1;
        return 0;
      });

    for (let i = 0; i < remainder; i++) {
      result[sorted[i % sorted.length]!.idx]!.shareMinor++;
    }
  }

  // Safety: verify sum equals total
  if (sumMinor(result) !== totalMinor) {
    throw new Error(
      `Split invariant broken: sum=${sumMinor(result)} expected=${totalMinor}`,
    );
  }

  return result;
}

// ── Subset Split ──

/**
 * Split total among ONLY the included members (equal split among them).
 * Non-included members get 0.
 * This is equivalent to splitEqual(totalMinor, includedMemberIds, payerId),
 * but the return includes ALL memberIds with 0 for excluded ones.
 */
export function splitSubset(
  totalMinor: number,
  includedMemberIds: string[],
  allMemberIds: string[],
  payerId: string,
): SplitEntry[] {
  if (includedMemberIds.length === 0) {
    throw new Error('At least one included member is required for subset split');
  }

  // Ensure all included members are in allMemberIds
  const allSet = new Set(allMemberIds);
  for (const id of includedMemberIds) {
    if (!allSet.has(id)) {
      throw new Error(`Member ${id} is not in the group`);
    }
  }

  // Split equally among included members only
  const split = splitEqual(totalMinor, includedMemberIds, payerId);
  const splitMap = new Map(split.map((s) => [s.memberId, s.shareMinor]));

  return allMemberIds.map((id) => ({
    memberId: id,
    shareMinor: splitMap.get(id) ?? 0,
  }));
}

// ── Validation helpers ──

/** Check if all split entries sum to the total minor amount. */
export function validateSplitSum(
  totalMinor: number,
  entries: SplitEntry[],
): boolean {
  return sumMinor(entries) === totalMinor;
}
