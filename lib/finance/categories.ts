import type { Ionicons } from '@expo/vector-icons';

// ──────────────────────────────────────
// Expense categories — labels via i18n
// ──────────────────────────────────────

export const CATEGORIES = [
  'market',
  'transport',
  'utilities',
  'entertainment',
  'travel',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Ionicons icon name for each category */
export const CATEGORY_ICONS: Record<Category, keyof typeof Ionicons.glyphMap> = {
  market: 'cart-outline',
  transport: 'car-outline',
  utilities: 'home-outline',
  entertainment: 'game-controller-outline',
  travel: 'airplane-outline',
  other: 'ellipsis-horizontal-outline',
};

/** Ionicons color for each category */
export const CATEGORY_COLORS: Record<Category, string> = {
  market: '#10B981',
  transport: '#3B82F6',
  utilities: '#F59E0B',
  entertainment: '#EC4899',
  travel: '#8B5CF6',
  other: '#6B7280',
};
