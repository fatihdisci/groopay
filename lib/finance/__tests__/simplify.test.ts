import { describe, it, expect } from 'vitest';
import { simplifyDebts } from '../simplify';

describe('simplifyDebts', () => {
  it('classic 3-person: A+50, B−30, C−20 → B→A 30, C→A 20', () => {
    const nets = [
      { memberId: 'A', netMinor: 5000 },   // +50.00
      { memberId: 'B', netMinor: -3000 },   // −30.00
      { memberId: 'C', netMinor: -2000 },   // −20.00
    ];
    const txs = simplifyDebts(nets);

    expect(txs).toHaveLength(2);
    // Both B and C pay A
    expect(txs.some((t) => t.from === 'B' && t.to === 'A' && t.amountMinor === 3000)).toBe(true);
    expect(txs.some((t) => t.from === 'C' && t.to === 'A' && t.amountMinor === 2000)).toBe(true);
  });

  it('already balanced: empty result', () => {
    const nets = [
      { memberId: 'A', netMinor: 0 },
      { memberId: 'B', netMinor: 0 },
    ];
    expect(simplifyDebts(nets)).toHaveLength(0);
  });

  it('empty input: empty result', () => {
    expect(simplifyDebts([])).toHaveLength(0);
  });

  it('cyclic debt (A→B→C→A) sums to 0 → empty result (everyone net 0)', () => {
    // All nets are 0 → everyone settled
    const nets = [
      { memberId: 'A', netMinor: 0 },
      { memberId: 'B', netMinor: 0 },
      { memberId: 'C', netMinor: 0 },
    ];
    expect(simplifyDebts(nets)).toHaveLength(0);
  });

  it('single pair: A+100, B−100 → B→A 100', () => {
    const nets = [
      { memberId: 'A', netMinor: 10000 },
      { memberId: 'B', netMinor: -10000 },
    ];
    const txs = simplifyDebts(nets);
    expect(txs).toHaveLength(1);
    expect(txs[0]!).toEqual({ from: 'B', to: 'A', amountMinor: 10000 });
  });

  it('4 people: A+70, B+30, C−60, D−40 → optimizes to 3 tx', () => {
    const nets = [
      { memberId: 'A', netMinor: 7000 },
      { memberId: 'B', netMinor: 3000 },
      { memberId: 'C', netMinor: -6000 },
      { memberId: 'D', netMinor: -4000 },
    ];
    const txs = simplifyDebts(nets);

    // Total transactions should be ≤ 3 (n-1 for 4 people with 2 creditors)
    expect(txs.length).toBeLessThanOrEqual(3);
    expect(txs.length).toBeGreaterThan(0);

    // Verify all debts are settled:
    // For each member, net = (received - paid) should match original net
    const settlement = new Map<string, number>();
    for (const m of nets) settlement.set(m.memberId, 0);
    for (const t of txs) {
      settlement.set(t.from, (settlement.get(t.from) ?? 0) - t.amountMinor);
      settlement.set(t.to, (settlement.get(t.to) ?? 0) + t.amountMinor);
    }
    for (const net of nets) {
      expect(settlement.get(net.memberId)).toBe(net.netMinor);
    }
  });

  it('4 people, 2 creditors 2 debtors, min tx = 3 (not 4)', () => {
    // A+80, B+20, C−50, D−50
    // Greedy: C(−50)→A(+80), D(−50)→A(+30)+B(+20) → 3 tx
    const nets = [
      { memberId: 'A', netMinor: 8000 },
      { memberId: 'B', netMinor: 2000 },
      { memberId: 'C', netMinor: -5000 },
      { memberId: 'D', netMinor: -5000 },
    ];
    const txs = simplifyDebts(nets);

    expect(txs.length).toBeLessThanOrEqual(3);
    expect(txs.length).toBeGreaterThan(0);

    const settlement = new Map<string, number>();
    for (const m of nets) settlement.set(m.memberId, 0);
    for (const t of txs) {
      settlement.set(t.from, (settlement.get(t.from) ?? 0) - t.amountMinor);
      settlement.set(t.to, (settlement.get(t.to) ?? 0) + t.amountMinor);
    }
    for (const net of nets) {
      expect(settlement.get(net.memberId)).toBe(net.netMinor);
    }
  });

  it('throws when sum of nets is not 0', () => {
    const nets = [
      { memberId: 'A', netMinor: 100 },
      { memberId: 'B', netMinor: -50 },
    ];
    expect(() => simplifyDebts(nets)).toThrow('sum of nets must be 0');
  });

  it('large amounts with no rounding errors', () => {
    const nets = [
      { memberId: 'A', netMinor: 1234567 },
      { memberId: 'B', netMinor: -1234567 },
    ];
    const txs = simplifyDebts(nets);
    expect(txs).toHaveLength(1);
    expect(txs[0]!.amountMinor).toBe(1234567);
  });

  it('kuruş precision: 0.01 TRY (1 minor)', () => {
    const nets = [
      { memberId: 'A', netMinor: 1 },
      { memberId: 'B', netMinor: -1 },
    ];
    const txs = simplifyDebts(nets);
    expect(txs).toHaveLength(1);
    expect(txs[0]!.amountMinor).toBe(1);
  });
});
