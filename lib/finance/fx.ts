// ──────────────────────────────────────
// FX — Display-only live rate from Frankfurter API
// This rate is NEVER saved to Supabase.
// It does NOT modify any expense/split values.
// ──────────────────────────────────────

const FRANKFURTER_BASE = 'https://api.frankfurter.dev';

export interface FxRateResult {
  from: string;
  to: string;
  rate: number;
  date: string; // YYYY-MM-DD
}

/**
 * Fetch the latest exchange rate from `from` currency to `to` currency.
 * If from === to, returns 1 without making an API call.
 * On any error, returns null — caller should silently skip conversion display.
 *
 * IMPORTANT: This is DISPLAY-ONLY. The rate is never stored in the database.
 */
export async function fetchRate(
  from: string,
  to: string,
): Promise<FxRateResult | null> {
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();

  if (fromUpper === toUpper) {
    return { from: fromUpper, to: toUpper, rate: 1, date: todayDate() };
  }

  try {
    const url = `${FRANKFURTER_BASE}/v1/latest?base=${fromUpper}&symbols=${toUpper}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`[FX] Frankfurter returned ${res.status} for ${fromUpper}→${toUpper}`);
      return null;
    }

    const json = await res.json();

    if (!json.rates?.[toUpper]) {
      console.warn(`[FX] Frankfurter returned no rate for ${toUpper}`);
      return null;
    }

    return {
      from: fromUpper,
      to: toUpper,
      rate: json.rates[toUpper] as number,
      date: json.date as string,
    };
  } catch (err) {
    console.warn(`[FX] Frankfurter fetch failed for ${fromUpper}→${toUpper}:`, err);
    return null;
  }
}

/**
 * Convert an amount using a fetched rate (for display only).
 * Returns the approximate converted amount rounded to 2 decimal places.
 */
export function convertDisplay(
  amount: number,
  rate: number,
): number {
  return parseFloat((amount * rate).toFixed(2));
}

function todayDate(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
