import { describe, it, expect } from 'vitest';
import { computeBalances, validateBalanceSum, groupByCurrency } from '../balance';
import type { ExpenseForBalance, SplitForBalance } from '../balance';

// ── Helpers ──

function makeExpense(
  overrides: Partial<ExpenseForBalance> & { id: string; paid_by: string; amount: number; currency: string },
): ExpenseForBalance {
  return { deleted_at: null, ...overrides };
}

function makeSplit(
  expense_id: string,
  member_id: string,
  share_amount: number,
): SplitForBalance {
  return { expense_id, member_id, share_amount };
}

// ── Tests ──

describe('computeBalances', () => {
  it('simple: A pays 100 TRY, split equally with B → A +50, B −50', () => {
    const expenses = [makeExpense({ id: 'e1', paid_by: 'A', amount: 100, currency: 'TRY' })];
    const splits = [
      makeSplit('e1', 'A', 50),
      makeSplit('e1', 'B', 50),
    ];

    const balances = computeBalances(expenses, splits);
    // A paid 100, share 50 → net +50 (10000 - 5000 minor = +5000 minor = +50 major)
    // B paid 0, share 50 → net −50
    const a = balances.find((b) => b.memberId === 'A' && b.currency === 'TRY')!;
    const b = balances.find((b) => b.memberId === 'B' && b.currency === 'TRY')!;
    expect(a.netMinor).toBe(5000);  // +50.00 TRY
    expect(b.netMinor).toBe(-5000); // −50.00 TRY
  });

  it('sum of all nets for each currency is 0', () => {
    const expenses = [
      makeExpense({ id: 'e1', paid_by: 'A', amount: 100, currency: 'TRY' }),
      makeExpense({ id: 'e2', paid_by: 'B', amount: 200, currency: 'TRY' }),
    ];
    const splits = [
      makeSplit('e1', 'A', 50), makeSplit('e1', 'B', 50),
      makeSplit('e2', 'A', 100), makeSplit('e2', 'B', 100),
    ];
    const balances = computeBalances(expenses, splits);
    const errors = validateBalanceSum(balances);
    expect(errors).toHaveLength(0);
  });

  it('multi-currency: EUR and TRY are completely separate', () => {
    const expenses = [
      makeExpense({ id: 'e1', paid_by: 'A', amount: 100, currency: 'TRY' }),
      makeExpense({ id: 'e2', paid_by: 'B', amount: 50, currency: 'EUR' }),
    ];
    const splits = [
      makeSplit('e1', 'A', 50), makeSplit('e1', 'B', 50),
      makeSplit('e2', 'A', 25), makeSplit('e2', 'B', 25),
    ];
    const balances = computeBalances(expenses, splits);

    // TRY: A paid 100, share 50 → +50; B share 50 → −50
    const aTry = balances.find((b) => b.memberId === 'A' && b.currency === 'TRY')!;
    const bTry = balances.find((b) => b.memberId === 'B' && b.currency === 'TRY')!;
    expect(aTry.netMinor).toBe(5000);
    expect(bTry.netMinor).toBe(-5000);

    // EUR: B paid 50, share 25 → +25; A share 25 → −25
    const aEur = balances.find((b) => b.memberId === 'A' && b.currency === 'EUR')!;
    const bEur = balances.find((b) => b.memberId === 'B' && b.currency === 'EUR')!;
    expect(aEur.netMinor).toBe(-2500);
    expect(bEur.netMinor).toBe(2500);

    // TRY sum = 0, EUR sum = 0
    const errors = validateBalanceSum(balances);
    expect(errors).toHaveLength(0);
  });

  it('deleted expense is excluded from balance', () => {
    const expenses = [
      makeExpense({ id: 'e1', paid_by: 'A', amount: 100, currency: 'TRY' }),
      makeExpense({ id: 'e2', paid_by: 'B', amount: 999, currency: 'TRY', deleted_at: '2026-01-01' }),
    ];
    const splits = [
      makeSplit('e1', 'A', 50), makeSplit('e1', 'B', 50),
      makeSplit('e2', 'A', 500), makeSplit('e2', 'B', 499),
    ];
    const balances = computeBalances(expenses, splits);

    // Only e1 counts
    const a = balances.find((b) => b.memberId === 'A' && b.currency === 'TRY')!;
    const b = balances.find((b) => b.memberId === 'B' && b.currency === 'TRY')!;
    expect(a.netMinor).toBe(5000);  // paid 100, share 50
    expect(b.netMinor).toBe(-5000); // share 50
  });

  it('three members, unequal splits', () => {
    const expenses = [
      makeExpense({ id: 'e1', paid_by: 'A', amount: 300, currency: 'TRY' }),
    ];
    const splits = [
      makeSplit('e1', 'A', 100),
      makeSplit('e1', 'B', 150),
      makeSplit('e1', 'C', 50),
    ];
    const balances = computeBalances(expenses, splits);

    // A: paid 300 + share 100 → +200
    // B: share 150 → −150
    // C: share 50 → −50
    const a = balances.find((b) => b.memberId === 'A')!;
    const b = balances.find((b) => b.memberId === 'B')!;
    const c = balances.find((b) => b.memberId === 'C')!;
    expect(a.netMinor).toBe(20000);
    expect(b.netMinor).toBe(-15000);
    expect(c.netMinor).toBe(-5000);
  });

  it('multiple expenses in same currency cumulate correctly', () => {
    const expenses = [
      makeExpense({ id: 'e1', paid_by: 'A', amount: 100, currency: 'TRY' }),
      makeExpense({ id: 'e2', paid_by: 'A', amount: 50, currency: 'TRY' }),
    ];
    const splits = [
      makeSplit('e1', 'A', 50), makeSplit('e1', 'B', 50),
      makeSplit('e2', 'A', 25), makeSplit('e2', 'B', 25),
    ];
    const balances = computeBalances(expenses, splits);

    // A: paid 150, share 75 → +75 (7500 minor)
    // B: share 75 → −75 (−7500 minor)
    const a = balances.find((b) => b.memberId === 'A')!;
    const b = balances.find((b) => b.memberId === 'B')!;
    expect(a.netMinor).toBe(7500);
    expect(b.netMinor).toBe(-7500);
  });

  it('member with zero net balance is excluded', () => {
    const expenses = [
      makeExpense({ id: 'e1', paid_by: 'A', amount: 50, currency: 'TRY' }),
    ];
    const splits = [
      makeSplit('e1', 'A', 50), // A paid 50, share 50 → net 0
    ];
    const balances = computeBalances(expenses, splits);

    // A's net is 0 → excluded
    const a = balances.find((b) => b.memberId === 'A');
    expect(a).toBeUndefined();
  });

  it('JPY (0 decimals) works correctly', () => {
    const expenses = [
      makeExpense({ id: 'e1', paid_by: 'A', amount: 1000, currency: 'JPY' }),
    ];
    const splits = [
      makeSplit('e1', 'A', 500),
      makeSplit('e1', 'B', 500),
    ];
    const balances = computeBalances(expenses, splits);
    const a = balances.find((b) => b.memberId === 'A')!;
    const b = balances.find((b) => b.memberId === 'B')!;
    expect(a.netMinor).toBe(500);   // paid 1000, share 500 → +500 yen
    expect(b.netMinor).toBe(-500);  // share 500 → −500 yen
  });
});

describe('computeBalances with settlements', () => {
  const baseExpenses = [
    { id: 'e1', paid_by: 'A', amount: 100, currency: 'TRY', deleted_at: null },
  ];
  const baseSplits = [
    { expense_id: 'e1', member_id: 'A', share_amount: 50 },
    { expense_id: 'e1', member_id: 'B', share_amount: 50 },
  ];
  // Without settlements: A +50, B −50

  it('confirmed settlement reduces debt: B pays A 25 TRY → A +25, B −25', () => {
    const settlements = [
      { from_member: 'B', to_member: 'A', amount: 25, currency: 'TRY', status: 'confirmed' },
    ];
    const balances = computeBalances(baseExpenses, baseSplits, settlements);
    // Before settlement: A +50 TRY, B −50 TRY (minor: +5000, −5000)
    // B pays A 25 TRY (2500 minor): A: 5000−2500=2500, B: −5000+2500=−2500
    const a = balances.find((b) => b.memberId === 'A')!;
    const b = balances.find((b) => b.memberId === 'B')!;
    expect(a.netMinor).toBe(2500);
    expect(b.netMinor).toBe(-2500);
  });

  it('pending settlement does NOT affect balance', () => {
    const settlements = [
      { from_member: 'B', to_member: 'A', amount: 25, currency: 'TRY', status: 'pending' },
    ];
    const balances = computeBalances(baseExpenses, baseSplits, settlements);
    const a = balances.find((b) => b.memberId === 'A')!;
    const b = balances.find((b) => b.memberId === 'B')!;
    expect(a.netMinor).toBe(5000);  // unchanged
    expect(b.netMinor).toBe(-5000); // unchanged
  });

  it('rejected settlement does NOT affect balance', () => {
    const settlements = [
      { from_member: 'B', to_member: 'A', amount: 25, currency: 'TRY', status: 'rejected' },
    ];
    const balances = computeBalances(baseExpenses, baseSplits, settlements);
    const a = balances.find((b) => b.memberId === 'A')!;
    const b = balances.find((b) => b.memberId === 'B')!;
    expect(a.netMinor).toBe(5000);
    expect(b.netMinor).toBe(-5000);
  });

  it('full settlement zeros out the debt', () => {
    const settlements = [
      { from_member: 'B', to_member: 'A', amount: 50, currency: 'TRY', status: 'confirmed' },
    ];
    const balances = computeBalances(baseExpenses, baseSplits, settlements);
    // Both should be 0 → excluded from result
    expect(balances.filter((b) => b.currency === 'TRY')).toHaveLength(0);
  });

  it('partial settlement: multiple confirmed payments accumulate', () => {
    const settlements = [
      { from_member: 'B', to_member: 'A', amount: 10, currency: 'TRY', status: 'confirmed' },
      { from_member: 'B', to_member: 'A', amount: 15, currency: 'TRY', status: 'confirmed' },
    ];
    const balances = computeBalances(baseExpenses, baseSplits, settlements);
    // A: 5000 − 2500 = 2500, B: −5000 + 2500 = −2500
    const a = balances.find((b) => b.memberId === 'A')!;
    const b = balances.find((b) => b.memberId === 'B')!;
    expect(a.netMinor).toBe(2500);
    expect(b.netMinor).toBe(-2500);
  });

  it('multi-currency: EUR settlement only affects EUR balance', () => {
    const expenses = [
      { id: 'e1', paid_by: 'A', amount: 100, currency: 'TRY', deleted_at: null },
      { id: 'e2', paid_by: 'B', amount: 50, currency: 'EUR', deleted_at: null },
    ];
    const splits = [
      { expense_id: 'e1', member_id: 'A', share_amount: 50 },
      { expense_id: 'e1', member_id: 'B', share_amount: 50 },
      { expense_id: 'e2', member_id: 'A', share_amount: 25 },
      { expense_id: 'e2', member_id: 'B', share_amount: 25 },
    ];
    // TRY: A +50, B −50  |  EUR: B +25, A −25
    const settlements = [
      { from_member: 'B', to_member: 'A', amount: 30, currency: 'TRY', status: 'confirmed' },
    ];
    const balances = computeBalances(expenses, splits, settlements);
    // TRY: A: 5000−3000=2000, B: −5000+3000=−2000
    const aTry = balances.find((b) => b.memberId === 'A' && b.currency === 'TRY')!;
    const bTry = balances.find((b) => b.memberId === 'B' && b.currency === 'TRY')!;
    expect(aTry.netMinor).toBe(2000);
    expect(bTry.netMinor).toBe(-2000);
    // EUR unchanged
    const aEur = balances.find((b) => b.memberId === 'A' && b.currency === 'EUR')!;
    const bEur = balances.find((b) => b.memberId === 'B' && b.currency === 'EUR')!;
    expect(aEur.netMinor).toBe(-2500);
    expect(bEur.netMinor).toBe(2500);
  });
});

describe('groupByCurrency', () => {
  it('groups balances by currency', () => {
    const balances = [
      { memberId: 'A', currency: 'TRY', netMinor: 5000 },
      { memberId: 'B', currency: 'TRY', netMinor: -5000 },
      { memberId: 'A', currency: 'EUR', netMinor: -2500 },
      { memberId: 'B', currency: 'EUR', netMinor: 2500 },
    ];
    const grouped = groupByCurrency(balances);
    expect(grouped.size).toBe(2);
    expect(grouped.get('TRY')).toHaveLength(2);
    expect(grouped.get('EUR')).toHaveLength(2);
  });

  it('returns empty map for empty input', () => {
    expect(groupByCurrency([]).size).toBe(0);
  });
});
