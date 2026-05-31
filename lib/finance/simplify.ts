// ──────────────────────────────────────
// Debt simplification — greedy min cash flow
// Single-currency only. All amounts in integer MINOR UNITS.
// ──────────────────────────────────────

export interface NetEntry {
  memberId: string;
  netMinor: number; // positive = creditor, negative = debtor
}

export interface SimplifiedTx {
  from: string;       // debtor (pays)
  to: string;         // creditor (receives)
  amountMinor: number; // amount in minor units
}

/**
 * Simplify debts for a SINGLE currency using greedy min cash flow.
 *
 * Algorithm:
 *   1. Separate creditors (net > 0) and debtors (net < 0)
 *   2. Sort both groups descending by absolute value
 *   3. Match largest creditor with largest debtor, settle the smaller amount
 *   4. Repeat until all nets are 0
 *
 * Returns the minimum number of transactions needed to settle all debts.
 * If all nets are already 0, returns empty array.
 */
export function simplifyDebts(nets: NetEntry[]): SimplifiedTx[] {
  // Filter zero-balance entries
  const nonZero = nets.filter((n) => n.netMinor !== 0);

  if (nonZero.length === 0) return [];

  // Verify total sum is 0 (within currency).
  // Small rounding errors (≤ 2 minor units) are tolerated and auto-corrected
  // by distributing the remainder to the largest creditor.
  const total = nonZero.reduce((a, n) => a + n.netMinor, 0);
  if (total !== 0) {
    if (Math.abs(total) <= 2) {
      // Auto-correct: add remainder to last creditor or debtor
      const target = total > 0
        ? nonZero.filter((n) => n.netMinor < 0).sort((a, b) => a.netMinor - b.netMinor)
        : nonZero.filter((n) => n.netMinor > 0).sort((a, b) => b.netMinor - a.netMinor);
      if (target.length > 0) {
        target[0]!.netMinor -= total;
      }
    } else {
      throw new Error(
        `simplifyDebts: sum of nets must be 0, got ${total}`,
      );
    }
  }

  const creditors = nonZero
    .filter((n) => n.netMinor > 0)
    .sort((a, b) => b.netMinor - a.netMinor)
    .map((n) => ({ ...n }));

  const debtors = nonZero
    .filter((n) => n.netMinor < 0)
    .sort((a, b) => a.netMinor - b.netMinor) // most negative first
    .map((n) => ({ memberId: n.memberId, netMinor: -n.netMinor })); // store as positive debt amount

  const transactions: SimplifiedTx[] = [];
  let ci = 0; // creditor index
  let di = 0; // debtor index

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]!;
    const debtor = debtors[di]!;

    const settleAmount = Math.min(creditor.netMinor, debtor.netMinor);

    if (settleAmount > 0) {
      transactions.push({
        from: debtor.memberId,
        to: creditor.memberId,
        amountMinor: settleAmount,
      });
    }

    creditor.netMinor -= settleAmount;
    debtor.netMinor -= settleAmount;

    if (creditor.netMinor <= 0) ci++;
    if (debtor.netMinor <= 0) di++;
  }

  return transactions;
}

/**
 * Format simplified transactions grouped by currency.
 * Each currency is simplified independently.
 */
export function simplifyByCurrency(
  netsByCurrency: Map<string, NetEntry[]>,
): Map<string, SimplifiedTx[]> {
  const result = new Map<string, SimplifiedTx[]>();
  for (const [currency, entries] of netsByCurrency) {
    result.set(currency, simplifyDebts(entries));
  }
  return result;
}
