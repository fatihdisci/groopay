// ──────────────────────────────────────
// Money utilities — integer minor units (kuruş)
// NEVER use float for calculation.
// ──────────────────────────────────────

/** Number of decimal places for a given currency code. */
const DECIMALS: Record<string, number> = {
  // 0 decimals (JPY, KRW, etc.)
  JPY: 0,
  KRW: 0,
  VND: 0,
  // 3 decimals (BHD, KWD, OMR, etc.)
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  // Default: 2 decimals (EUR, USD, TRY, GBP, etc.)
};

const DEFAULT_DECIMALS = 2;

export function getDecimals(currency: string): number {
  const upper = currency.toUpperCase();
  return DECIMALS[upper] ?? DEFAULT_DECIMALS;
}

/**
 * Convert a decimal amount to integer minor units.
 * e.g. toMinor(100.00, 'TRY') → 10000
 *      toMinor(500, 'JPY')   → 500
 */
export function toMinor(amount: number, currency: string): number {
  const decimals = getDecimals(currency);
  const factor = 10 ** decimals;
  // Use rounding to handle floating-point edge cases
  return Math.round(amount * factor);
}

/**
 * Convert integer minor units to a decimal amount.
 * e.g. fromMinor(10000, 'TRY') → 100.00
 *      fromMinor(500, 'JPY')   → 500
 */
export function fromMinor(minor: number, currency: string): number {
  const decimals = getDecimals(currency);
  const factor = 10 ** decimals;
  // Parse to avoid floating-point artifacts (e.g. 100.00000000000001)
  return parseFloat((minor / factor).toFixed(decimals));
}

/** Supported currencies for the app (subset of Frankfurter-supported currencies). */
export const SUPPORTED_CURRENCIES = [
  { code: 'TRY', label: 'Türk Lirası (₺)', symbol: '₺', flag: '🇹🇷' },
  { code: 'EUR', label: 'Euro (€)', symbol: '€', flag: '🇪🇺' },
  { code: 'USD', label: 'ABD Doları ($)', symbol: '$', flag: '🇺🇸' },
  { code: 'GBP', label: 'İngiliz Sterlini (£)', symbol: '£', flag: '🇬🇧' },
  { code: 'JPY', label: 'Japon Yeni (¥)', symbol: '¥', flag: '🇯🇵' },
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
  { code: 'KRW', label: 'Güney Kore Wonu', symbol: '₩', flag: '🇰🇷' },
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
