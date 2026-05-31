import { describe, it, expect } from 'vitest';
import {
  splitEqual,
  splitCustomAmounts,
  splitCustomShares,
  splitSubset,
  validateSplitSum,
} from '../split';
import type { SplitEntry } from '../split';

describe('splitEqual', () => {
  it('splits 100.00 TRY (10000 kuruş) among 3 members → 3334 + 3333 + 3333', () => {
    const result = splitEqual(10000, ['a', 'b', 'c'], 'a');
    expect(result).toHaveLength(3);
    // Payer 'a' should get the remainder (10000 - 3*3333 = 1)
    const a = result.find((r) => r.memberId === 'a')!;
    const b = result.find((r) => r.memberId === 'b')!;
    const c = result.find((r) => r.memberId === 'c')!;
    expect(a.shareMinor).toBe(3334); // payer gets remainder
    expect(b.shareMinor).toBe(3333);
    expect(c.shareMinor).toBe(3333);
    expect(a.shareMinor + b.shareMinor + c.shareMinor).toBe(10000);
  });

  it('splits 0.01 TRY (1 kuruş) among 2 members → 1 + 0', () => {
    const result = splitEqual(1, ['a', 'b'], 'a');
    expect(result).toHaveLength(2);
    const a = result.find((r) => r.memberId === 'a')!;
    const b = result.find((r) => r.memberId === 'b')!;
    expect(a.shareMinor).toBe(1); // payer gets the 1 kuruş
    expect(b.shareMinor).toBe(0);
    expect(a.shareMinor + b.shareMinor).toBe(1);
  });

  it('splits 10.00 (1000) among 4 members → 250 each, no remainder', () => {
    const result = splitEqual(1000, ['a', 'b', 'c', 'd'], 'a');
    expect(result).toHaveLength(4);
    for (const r of result) {
      expect(r.shareMinor).toBe(250);
    }
    const total = result.reduce((a, r) => a + r.shareMinor, 0);
    expect(total).toBe(1000);
  });

  it('assigns remainder to first member if payer is not in list', () => {
    const result = splitEqual(10000, ['a', 'b', 'c'], 'x');
    const a = result.find((r) => r.memberId === 'a')!;
    expect(a.shareMinor).toBe(3334); // first member gets remainder
  });

  it('handles JPY (0 decimals) — 500 yen among 2 → 250 each', () => {
    const result = splitEqual(500, ['a', 'b'], 'a');
    const total = result.reduce((a, r) => a + r.shareMinor, 0);
    expect(total).toBe(500);
    expect(result.every((r) => r.shareMinor === 250)).toBe(true);
  });

  it('handles single member — gets all', () => {
    const result = splitEqual(10000, ['a'], 'a');
    expect(result).toHaveLength(1);
    expect(result[0]!.shareMinor).toBe(10000);
  });

  it('throws on empty member list', () => {
    expect(() => splitEqual(100, [], 'a')).toThrow(
      'At least one member is required',
    );
  });

  it('throws on negative amount', () => {
    expect(() => splitEqual(-100, ['a', 'b'], 'a')).toThrow(
      'Total amount cannot be negative',
    );
  });

  it('total sum always equals input (property-based check)', () => {
    const testCases = [
      { total: 10000, members: ['a', 'b', 'c'], payer: 'a' },
      { total: 1, members: ['a', 'b'], payer: 'b' },
      { total: 99999, members: ['a', 'b', 'c', 'd', 'e'], payer: 'c' },
      { total: 100, members: ['a', 'b', 'c', 'd'], payer: 'd' },
      { total: 7, members: ['a', 'b', 'c'], payer: 'b' },
      { total: 5000, members: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], payer: 'a' },
    ];
    for (const tc of testCases) {
      const result = splitEqual(tc.total, tc.members, tc.payer);
      const sum = result.reduce((a, r) => a + r.shareMinor, 0);
      expect(sum).toBe(tc.total);
    }
  });
});

describe('splitCustomAmounts', () => {
  it('accepts valid custom amounts that sum to total', () => {
    const result = splitCustomAmounts(10000, [
      { memberId: 'a', amountMinor: 5000 },
      { memberId: 'b', amountMinor: 3000 },
      { memberId: 'c', amountMinor: 2000 },
    ]);
    expect(result).toHaveLength(3);
    expect(result[0]!.shareMinor).toBe(5000);
    expect(result[1]!.shareMinor).toBe(3000);
    expect(result[2]!.shareMinor).toBe(2000);
  });

  it('throws when custom amounts do NOT sum to total', () => {
    expect(() =>
      splitCustomAmounts(10000, [
        { memberId: 'a', amountMinor: 5000 },
        { memberId: 'b', amountMinor: 3000 },
      ]),
    ).toThrow('does not equal total');
  });

  it('throws when custom amounts exceed total', () => {
    expect(() =>
      splitCustomAmounts(10000, [
        { memberId: 'a', amountMinor: 6000 },
        { memberId: 'b', amountMinor: 5000 },
      ]),
    ).toThrow('does not equal total');
  });

  it('handles single member with exact amount', () => {
    const result = splitCustomAmounts(5000, [
      { memberId: 'a', amountMinor: 5000 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.shareMinor).toBe(5000);
  });

  it('handles zero amounts (allowed)', () => {
    const result = splitCustomAmounts(10000, [
      { memberId: 'a', amountMinor: 10000 },
      { memberId: 'b', amountMinor: 0 },
    ]);
    expect(result).toHaveLength(2);
    const total = result.reduce((a, r) => a + r.shareMinor, 0);
    expect(total).toBe(10000);
  });

  it('throws on empty entries', () => {
    expect(() => splitCustomAmounts(100, [])).toThrow('At least one entry');
  });
});

describe('splitCustomShares', () => {
  it('splits 100.00 (10000) with ratio 1:2:1 → 25/50/25', () => {
    const result = splitCustomShares(
      10000,
      [
        { memberId: 'a', shares: 1 },
        { memberId: 'b', shares: 2 },
        { memberId: 'c', shares: 1 },
      ],
      'a',
    );
    expect(result).toHaveLength(3);
    expect(result[0]!.shareMinor).toBe(2500);
    expect(result[1]!.shareMinor).toBe(5000);
    expect(result[2]!.shareMinor).toBe(2500);
    const total = result.reduce((a, r) => a + r.shareMinor, 0);
    expect(total).toBe(10000);
  });

  it('handles remainder: 100 kuruş with ratio 1:1:1 (33 each + 1 to largest/payer)', () => {
    const result = splitCustomShares(
      100,
      [
        { memberId: 'a', shares: 1 },
        { memberId: 'b', shares: 1 },
        { memberId: 'c', shares: 1 },
      ],
      'a',
    );
    const total = result.reduce((a, r) => a + r.shareMinor, 0);
    expect(total).toBe(100);
  });

  it('assigns remainder to payer when shares are tied', () => {
    const result = splitCustomShares(
      100,
      [
        { memberId: 'a', shares: 1 },
        { memberId: 'b', shares: 1 },
        { memberId: 'c', shares: 1 },
      ],
      'b', // payer = b
    );
    const payerEntry = result.find((r) => r.memberId === 'b')!;
    const others = result.filter((r) => r.memberId !== 'b');
    // Payer should have more or equal due to being preferred in tie
    expect(payerEntry.shareMinor).toBeGreaterThanOrEqual(
      Math.max(...others.map((r) => r.shareMinor)),
    );
    const total = result.reduce((a, r) => a + r.shareMinor, 0);
    expect(total).toBe(100);
  });

  it('handles ratio 3:1 → 75/25 for 100 kuruş', () => {
    const result = splitCustomShares(
      100,
      [
        { memberId: 'a', shares: 3 },
        { memberId: 'b', shares: 1 },
      ],
      'a',
    );
    expect(result[0]!.shareMinor).toBe(75);
    expect(result[1]!.shareMinor).toBe(25);
    const total = result.reduce((a, r) => a + r.shareMinor, 0);
    expect(total).toBe(100);
  });

  it('handles JPY with shares: 500 yen, ratio 1:1 → 250 each', () => {
    const result = splitCustomShares(
      500,
      [
        { memberId: 'a', shares: 1 },
        { memberId: 'b', shares: 1 },
      ],
      'a',
    );
    const total = result.reduce((a, r) => a + r.shareMinor, 0);
    expect(total).toBe(500);
    expect(result[0]!.shareMinor).toBe(250);
    expect(result[1]!.shareMinor).toBe(250);
  });

  it('throws on zero total shares', () => {
    expect(() =>
      splitCustomShares(
        100,
        [{ memberId: 'a', shares: 0 }],
        'a',
      ),
    ).toThrow('Total shares must be positive');
  });

  it('throws on negative amount', () => {
    expect(() =>
      splitCustomShares(
        -100,
        [{ memberId: 'a', shares: 1 }],
        'a',
      ),
    ).toThrow('Total amount cannot be negative');
  });
});

describe('splitSubset', () => {
  it('splits among 3 of 5 members equally', () => {
    const result = splitSubset(
      9000, // 90.00
      ['a', 'b', 'c'], // included
      ['a', 'b', 'c', 'd', 'e'], // all members
      'a',
    );
    expect(result).toHaveLength(5);
    // Included members each get 3000
    for (const r of result) {
      if (['a', 'b', 'c'].includes(r.memberId)) {
        expect(r.shareMinor).toBe(3000);
      } else {
        expect(r.shareMinor).toBe(0);
      }
    }
    const total = result.reduce((a, r) => a + r.shareMinor, 0);
    expect(total).toBe(9000);
  });

  it('handles single included member out of many', () => {
    const result = splitSubset(5000, ['c'], ['a', 'b', 'c', 'd'], 'c');
    expect(result).toHaveLength(4);
    const c = result.find((r) => r.memberId === 'c')!;
    expect(c.shareMinor).toBe(5000);
    for (const r of result) {
      if (r.memberId !== 'c') expect(r.shareMinor).toBe(0);
    }
  });

  it('throws when included member is not in allMemberIds', () => {
    expect(() =>
      splitSubset(10000, ['x'], ['a', 'b', 'c'], 'a'),
    ).toThrow('is not in the group');
  });

  it('throws on empty included list', () => {
    expect(() =>
      splitSubset(10000, [], ['a', 'b', 'c'], 'a'),
    ).toThrow('At least one included member');
  });
});

describe('validateSplitSum', () => {
  it('returns true for valid split', () => {
    const entries: SplitEntry[] = [
      { memberId: 'a', shareMinor: 3334 },
      { memberId: 'b', shareMinor: 3333 },
      { memberId: 'c', shareMinor: 3333 },
    ];
    expect(validateSplitSum(10000, entries)).toBe(true);
  });

  it('returns false for mismatched split', () => {
    const entries: SplitEntry[] = [
      { memberId: 'a', shareMinor: 3000 },
      { memberId: 'b', shareMinor: 3000 },
    ];
    expect(validateSplitSum(10000, entries)).toBe(false);
  });
});
