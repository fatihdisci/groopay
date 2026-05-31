import { describe, it, expect } from 'vitest';
import { toMinor, fromMinor, getDecimals } from '../money';

describe('getDecimals', () => {
  it('returns 2 for TRY', () => {
    expect(getDecimals('TRY')).toBe(2);
  });

  it('returns 2 for EUR', () => {
    expect(getDecimals('EUR')).toBe(2);
  });

  it('returns 2 for USD', () => {
    expect(getDecimals('USD')).toBe(2);
  });

  it('returns 0 for JPY', () => {
    expect(getDecimals('JPY')).toBe(0);
  });

  it('returns 0 for KRW', () => {
    expect(getDecimals('KRW')).toBe(0);
  });

  it('returns 3 for BHD', () => {
    expect(getDecimals('BHD')).toBe(3);
  });

  it('returns 2 for unknown currency (default)', () => {
    expect(getDecimals('XYZ')).toBe(2);
  });

  it('is case-insensitive', () => {
    expect(getDecimals('try')).toBe(2);
    expect(getDecimals('jpy')).toBe(0);
    expect(getDecimals('eur')).toBe(2);
  });
});

describe('toMinor', () => {
  it('converts 100.00 TRY to 10000 kuruş', () => {
    expect(toMinor(100.0, 'TRY')).toBe(10000);
  });

  it('converts 0.01 TRY to 1 kuruş', () => {
    expect(toMinor(0.01, 'TRY')).toBe(1);
  });

  it('converts 0.99 TRY to 99 kuruş', () => {
    expect(toMinor(0.99, 'TRY')).toBe(99);
  });

  it('converts 500 JPY to 500 (0 decimals)', () => {
    expect(toMinor(500, 'JPY')).toBe(500);
  });

  it('converts 99999 JPY to 99999 (0 decimals)', () => {
    expect(toMinor(99999, 'JPY')).toBe(99999);
  });

  it('rounds correctly for floating point edge cases', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in floating point
    expect(toMinor(0.1 + 0.2, 'TRY')).toBe(30);
  });
});

describe('fromMinor', () => {
  it('converts 10000 kuruş to 100.00 TRY', () => {
    expect(fromMinor(10000, 'TRY')).toBe(100.0);
  });

  it('converts 1 kuruş to 0.01 TRY', () => {
    expect(fromMinor(1, 'TRY')).toBe(0.01);
  });

  it('converts 500 minor to 500 JPY', () => {
    expect(fromMinor(500, 'JPY')).toBe(500);
  });

  it('handles 0 minor', () => {
    expect(fromMinor(0, 'TRY')).toBe(0);
  });
});

describe('toMinor/fromMinor roundtrip', () => {
  it('converts back and forth correctly for TRY', () => {
    const original = 123.45;
    const minor = toMinor(original, 'TRY');
    const back = fromMinor(minor, 'TRY');
    expect(back).toBe(original);
  });

  it('converts back and forth correctly for JPY', () => {
    const original = 5000;
    const minor = toMinor(original, 'JPY');
    const back = fromMinor(minor, 'JPY');
    expect(back).toBe(original);
  });

  it('converts back and forth for EUR', () => {
    const original = 99.99;
    const minor = toMinor(original, 'EUR');
    const back = fromMinor(minor, 'EUR');
    expect(back).toBe(original);
  });
});
