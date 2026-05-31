import { useQuery } from '@tanstack/react-query';
import { fetchRate, convertDisplay } from '@/lib/finance/fx';

/**
 * Hook for display-only FX rate.
 * Cached for 1 hour (daily rate is sufficient).
 * Returns null on error — caller should silently skip conversion.
 */
export function useFxRate(from: string, to: string) {
  return useQuery({
    queryKey: ['fx-rate', from.toUpperCase(), to.toUpperCase()],
    queryFn: async () => {
      const result = await fetchRate(from, to);
      return result;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 60 * 60 * 1000,
    enabled: from.toUpperCase() !== to.toUpperCase(),
    retry: 1,
    // Don't throw on error — just return null so UI can skip
    throwOnError: false,
  });
}

/**
 * Convert an amount using a rate for display purposes only.
 * Returns the formatted string like "≈ 2.100,50 TRY" or null if conversion unavailable.
 */
export function formatFxDisplay(
  amount: number,
  rate: number | undefined | null,
  toCurrency: string,
  locale: string = 'tr',
): string | null {
  if (rate == null || rate === 1) return null;
  const converted = convertDisplay(amount, rate);
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: toCurrency,
  }).format(converted);
  return formatted;
}
