// ──────────────────────────────────────
// Balance calculation — pure functions
// All amounts in integer MINOR UNITS.
// Per-currency: never mix currencies.
// ──────────────────────────────────────

import { toMinor } from './money';

// ── Input types (decoupled from Supabase shapes) ──

export interface ExpenseForBalance {
  id: string;
  paid_by: string;        // group_members.id
  amount: number;         // decimal (from DB numeric)
  currency: string;
  deleted_at: string | null;
}

export interface SplitForBalance {
  expense_id: string;
  member_id: string;
  share_amount: number;   // decimal (from DB numeric)
}

/** Phase 6 — confirmed settlements. Optional, not used in Phase 5. */
export interface SettlementForBalance {
  from_member: string;
  to_member: string;
  amount: number;          // decimal
  currency: string;
  status: string;
}

export interface MemberBalance {
  memberId: string;
  currency: string;
  netMinor: number;        // positive = creditor, negative = debtor
}

// ── Core computation ──

/**
 * Compute net balance for each member, per currency.
 *
 * Phase 5: uses expenses + splits only (settlements optional for Phase 6).
 * Deleted expenses (deleted_at != null) are excluded.
 *
 * Returns array of { memberId, currency, netMinor }.
 * For each currency, Σ netMinor = 0.
 */
export function computeBalances(
  expenses: ExpenseForBalance[],
  splits: SplitForBalance[],
  settlements?: SettlementForBalance[],
): MemberBalance[] {
  // Index splits by expense_id for fast lookup
  const splitsByExpense = new Map<string, SplitForBalance[]>();
  for (const s of splits) {
    const list = splitsByExpense.get(s.expense_id) ?? [];
    list.push(s);
    splitsByExpense.set(s.expense_id, list);
  }

  // Map: currency → (memberId → netMinor)
  const currencyMap = new Map<string, Map<string, number>>();

  const ensureEntry = (currency: string, memberId: string): Map<string, number> => {
    let memberMap = currencyMap.get(currency);
    if (!memberMap) {
      memberMap = new Map();
      currencyMap.set(currency, memberMap);
    }
    if (!memberMap.has(memberId)) {
      memberMap.set(memberId, 0);
    }
    return memberMap;
  };

  // Process active expenses
  for (const exp of expenses) {
    if (exp.deleted_at) continue; // skip soft-deleted

    const currency = exp.currency;
    const paidMinor = toMinor(exp.amount, currency);

    // Payer: +amount (they paid)
    const payerMap = ensureEntry(currency, exp.paid_by);
    payerMap.set(exp.paid_by, (payerMap.get(exp.paid_by) ?? 0) + paidMinor);

    // Each split participant: -share_amount
    const expSplits = splitsByExpense.get(exp.id) ?? [];
    for (const split of expSplits) {
      const shareMinor = toMinor(split.share_amount, currency);
      const memberMap = ensureEntry(currency, split.member_id);
      memberMap.set(split.member_id, (memberMap.get(split.member_id) ?? 0) - shareMinor);
    }
  }

  // Phase 6: process confirmed settlements (optional)
  if (settlements) {
    for (const s of settlements) {
      if (s.status !== 'confirmed') continue;
      const settMinor = toMinor(s.amount, s.currency);
      // from_member pays (gets more negative / less positive): subtract from their net?
      // Wait: settlement flow: debtor "ödedi" → from_member is debtor who paid
      // from_member's net should INCREASE (they paid their debt)
      // to_member's net should DECREASE (they received payment)
      // So: from_member +settMinor, to_member -settMinor
      const fromMap = ensureEntry(s.currency, s.from_member);
      fromMap.set(s.from_member, (fromMap.get(s.from_member) ?? 0) + settMinor);
      const toMap = ensureEntry(s.currency, s.to_member);
      toMap.set(s.to_member, (toMap.get(s.to_member) ?? 0) - settMinor);
    }
  }

  // Flatten to array
  const result: MemberBalance[] = [];
  for (const [currency, memberMap] of currencyMap) {
    for (const [memberId, netMinor] of memberMap) {
      if (netMinor !== 0) {
        result.push({ memberId, currency, netMinor });
      }
    }
  }

  return result;
}

/**
 * Validate that for each currency, the sum of all netMinor values is 0.
 * Returns the imbalances (if any), empty array if perfect.
 */
export function validateBalanceSum(
  balances: MemberBalance[],
): { currency: string; sum: number }[] {
  const sums = new Map<string, number>();
  for (const b of balances) {
    sums.set(b.currency, (sums.get(b.currency) ?? 0) + b.netMinor);
  }
  return [...sums.entries()]
    .filter(([, sum]) => sum !== 0)
    .map(([currency, sum]) => ({ currency, sum }));
}

/**
 * Group balances by currency. Returns Map<currency, MemberBalance[]>.
 */
export function groupByCurrency(
  balances: MemberBalance[],
): Map<string, MemberBalance[]> {
  const map = new Map<string, MemberBalance[]>();
  for (const b of balances) {
    const list = map.get(b.currency) ?? [];
    list.push(b);
    map.set(b.currency, list);
  }
  return map;
}
