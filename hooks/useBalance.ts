import { useMemo } from 'react';
import { computeBalances, groupByCurrency, simplifyDebts } from '@/lib/finance';
import type { MemberBalance, SimplifiedTx, SettlementForBalance } from '@/lib/finance';
import type { ExpenseRow, ExpenseSplitRow } from '@/lib/supabase/types';

export interface BalanceByCurrency {
  currency: string;
  balances: MemberBalance[];
  simplified: SimplifiedTx[];
}

/**
 * Compute raw balances and simplified debts from expenses + splits + settlements.
 * All per-currency. Returns grouped by currency.
 */
export function useBalance(
  expenses: ExpenseRow[],
  splits: ExpenseSplitRow[],
  settlements?: SettlementForBalance[],
): Map<string, BalanceByCurrency> {
  return useMemo(() => {
    const balances = computeBalances(expenses, splits, settlements);
    const grouped = groupByCurrency(balances);

    const result = new Map<string, BalanceByCurrency>();
    for (const [currency, currencyBalances] of grouped) {
      const nets = currencyBalances.map((b) => ({
        memberId: b.memberId,
        netMinor: b.netMinor,
      }));
      result.set(currency, {
        currency,
        balances: currencyBalances,
        simplified: simplifyDebts(nets),
      });
    }
    return result;
  }, [expenses, splits, settlements]);
}
