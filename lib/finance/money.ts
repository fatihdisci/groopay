// ──────────────────────────────────────
// Money utilities — integer minor units (kuruş)
// NEVER use float for calculation.
//
// ⚠️  numeric(14,2) limitation: only 2-decimal currencies
//     supported until integer minor unit migration (Faz 9).
//     0-dec (JPY, KRW, VND) and 3-dec (BHD, KWD, OMR, TND)
//     currencies will be re-added after the migration.
// ──────────────────────────────────────

/**
 * Number of decimal places for a given currency code.
 * Internal — supports 0/2/3 decimals for forward compat.
 * Only 2-decimal currencies appear in SUPPORTED_CURRENCIES (UI).
 * 0/3-decimal currencies will be re-enabled in Faz 9 (integer minor unit).
 */
const DECIMALS: Record<string, number> = {
  // 0 decimals — currently hidden from UI
  JPY: 0,
  KRW: 0,
  VND: 0,
  // 3 decimals — currently hidden from UI
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  // Default: 2 decimals for all supported currencies
};

const DEFAULT_DECIMALS = 2;

export function getDecimals(currency: string): number {
  const upper = currency.toUpperCase();
  return DECIMALS[upper] ?? DEFAULT_DECIMALS;
}

/**
 * Convert a decimal amount to integer minor units.
 * e.g. toMinor(100.00, 'TRY') → 10000
 * Prefer parseMoneyInputToMinor for user input (string → integer, no float).
 */
export function toMinor(amount: number, currency: string): number {
  const decimals = getDecimals(currency);
  const factor = 10 ** decimals;
  return Math.round(amount * factor);
}

/**
 * Convert integer minor units to a decimal amount.
 * e.g. fromMinor(10000, 'TRY') → 100.00
 */
export function fromMinor(minor: number, currency: string): number {
  const decimals = getDecimals(currency);
  const factor = 10 ** decimals;
  return parseFloat((minor / factor).toFixed(decimals));
}

/**
 * Parse a user-entered amount string directly to integer minor units.
 * NO float intermediate — avoids IEEE 754 precision issues entirely.
 *
 * Accepts both comma and dot as decimal separator.
 * Handles inverted inputs (European format).
 *
 *   parseMoneyInputToMinor("19.99", "TRY") → 1999
 *   parseMoneyInputToMinor("19,99", "TRY") → 1999
 *   parseMoneyInputToMinor("100", "TRY")   → 10000
 *   parseMoneyInputToMinor("0,01", "TRY")  → 1
 *   parseMoneyInputToMinor("5,5", "TRY")   → 550
 *   parseMoneyInputToMinor("1.000,50", "TRY") → 100050 (thousands sep stripped)
 */
export function parseMoneyInputToMinor(input: string, currency: string): number {
  const decimals = getDecimals(currency);

  // Strip whitespace and currency symbols
  let cleaned = input.trim()
    .replace(/[₺$€£¥]/g, '')
    .replace(/\s/g, '');

  if (cleaned === '' || cleaned === '-' || cleaned === '.') return 0;

  // Detect format: if both , and . present, the last one is decimal separator
  const commaCount = (cleaned.match(/,/g) ?? []).length;
  const dotCount = (cleaned.match(/\./g) ?? []).length;

  let intPart: string;
  let fracPart: string;

  if (commaCount > 0 && dotCount > 0) {
    // Both present: last occurrence is decimal separator
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      // e.g. 1.000,50 → dot is thousands, comma is decimal
      intPart = cleaned.slice(0, lastComma).replace(/[.,]/g, '');
      fracPart = cleaned.slice(lastComma + 1);
    } else {
      // e.g. 1,000.50 → comma is thousands, dot is decimal
      intPart = cleaned.slice(0, lastDot).replace(/[.,]/g, '');
      fracPart = cleaned.slice(lastDot + 1);
    }
  } else if (commaCount === 1 && dotCount === 0) {
    // Only comma: could be thousands (1000) or decimal (19,99)
    // If comma is followed by exactly the right number of digits, it's decimal
    const commaPos = cleaned.indexOf(',');
    const afterComma = cleaned.slice(commaPos + 1);
    if (afterComma.length <= decimals) {
      // Decimal separator: 19,99
      intPart = cleaned.slice(0, commaPos);
      fracPart = afterComma;
    } else {
      // Thousands separator: 10000 (nothing after last 3 digits)
      intPart = cleaned.replace(',', '');
      fracPart = '';
    }
  } else if (dotCount === 1 && commaCount === 0) {
    // Only dot: same logic as comma
    const dotPos = cleaned.indexOf('.');
    const afterDot = cleaned.slice(dotPos + 1);
    if (afterDot.length <= decimals) {
      intPart = cleaned.slice(0, dotPos);
      fracPart = afterDot;
    } else {
      intPart = cleaned.replace('.', '');
      fracPart = '';
    }
  } else {
    // No separators or multiple same separator (strip all)
    intPart = cleaned.replace(/[.,]/g, '');
    fracPart = '';
  }

  // Remove any remaining non-digit chars from int part
  intPart = intPart.replace(/\D/g, '');
  if (intPart === '') intPart = '0';

  // Pad or truncate fractional part to decimals
  fracPart = fracPart.replace(/\D/g, '');
  fracPart = fracPart.padEnd(decimals, '0').slice(0, decimals);

  // Integer arithmetic — NO float
  const integer = parseInt(intPart, 10);
  const fractional = parseInt(fracPart, 10);

  return integer * (10 ** decimals) + fractional;
}

/**
 * Supported currencies for the app.
 * ⚠️ Currently limited to 2-decimal currencies only (numeric(14,2) constraint).
 *     0/3-decimal currencies will be re-added in Faz 9 (integer minor unit migration).
 */
export const SUPPORTED_CURRENCIES = [
  { code: 'TRY', label: 'Türk Lirası (₺)', symbol: '₺', flag: '🇹🇷' },
  { code: 'EUR', label: 'Euro (€)', symbol: '€', flag: '🇪🇺' },
  { code: 'USD', label: 'ABD Doları ($)', symbol: '$', flag: '🇺🇸' },
  { code: 'GBP', label: 'İngiliz Sterlini (£)', symbol: '£', flag: '🇬🇧' },
  { code: 'CHF', label: 'İsviçre Frangı', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'SEK', label: 'İsveç Kronu', symbol: 'kr', flag: '🇸🇪' },
  { code: 'NOK', label: 'Norveç Kronu', symbol: 'kr', flag: '🇳🇴' },
  { code: 'DKK', label: 'Danimarka Kronu', symbol: 'kr', flag: '🇩🇰' },
  { code: 'PLN', label: 'Polonya Zlotisi', symbol: 'zł', flag: '🇵🇱' },
  { code: 'CZK', label: 'Çek Korunası', symbol: 'Kč', flag: '🇨🇿' },
  { code: 'HUF', label: 'Macar Forinti', symbol: 'Ft', flag: '🇭🇺' },
  { code: 'RON', label: 'Rumen Leyi', symbol: 'lei', flag: '🇷🇴' },
  { code: 'BGN', label: 'Bulgar Levi', symbol: 'лв', flag: '🇧🇬' },
  { code: 'AED', label: 'BAE Dirhemi', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'SAR', label: 'Suudi Riyali', symbol: '﷼', flag: '🇸🇦' },
  { code: 'AUD', label: 'Avustralya Doları', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', label: 'Kanada Doları', symbol: 'C$', flag: '🇨🇦' },
  { code: 'CNY', label: 'Çin Yuanı', symbol: '¥', flag: '🇨🇳' },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]['code'];

export function getCurrencyInfo(code: string) {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code.toUpperCase());
}

/**
 * Format a decimal amount for display using Intl.NumberFormat with tr-TR locale.
 * Includes currency symbol, thousands separator (.), and decimal comma (,).
 *
 *   formatAmount(591.63, 'TRY') → "₺591,63"
 *   formatAmount(50050.5, 'TRY') → "₺50.050,50"
 *   formatAmount(50, 'EUR') → "€50,00"
 *   formatAmount(100, 'USD') → "$100,00"
 *
 * Falls back to "amount currency" on invalid currency codes.
 */
export function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(getDecimals(currency))} ${currency}`;
  }
}
