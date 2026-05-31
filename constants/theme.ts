// constants/theme.ts
// Groopay Design System v2.0
// Modern fintech: açık zemin, gradient aksanlar, bold typography

export const Colors = {
  // === ARKA PLAN ===
  // Saf beyaz değil — hafif mor tonu taşıyan off-white.
  // Groopay'in primary rengi (mor) ile uyum sağlar, göz yormaz.
  background: '#F7F6FF',
  backgroundSecondary: '#EFEEFC',  // hafif daha koyu, section ayırıcı

  // === YÜZEYLER (kartlar, modal'lar) ===
  surface: '#FFFFFF',
  surfaceTinted: 'rgba(79, 70, 229, 0.05)',  // subtle mor tint — aktif/seçili durumlar
  surfaceElevated: '#FFFFFF',  // floating card, modal

  // === PRIMARY (Groopay moru — koru) ===
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primaryLight: '#818CF8',
  primaryGhost: 'rgba(79, 70, 229, 0.1)',  // ghost buton arka plan

  // === GRADİENT ===
  // Sadece header/hero alanlarında kullan, her yerde değil.
  gradientStart: '#4F46E5',
  gradientEnd: '#7C3AED',
  gradientArray: ['#4F46E5', '#7C3AED'] as const,

  // === SEMANTİK (finansal durumlar) ===
  credit: '#10B981',        // emerald — alacak, pozitif
  creditLight: '#D1FAE5',   // alacak arka plan tint
  creditDark: '#065F46',    // alacak koyu metin
  debt: '#F43F5E',          // rose — borç, negatif
  debtLight: '#FFE4E6',     // borç arka plan tint
  debtDark: '#9F1239',      // borç koyu metin
  warning: '#F59E0B',       // amber — pending/uyarı
  warningLight: '#FEF3C7',

  // === METİN ===
  textPrimary: '#0D0D14',    // near-black, hafif sıcak — saf siyahtan daha yumuşak
  textSecondary: '#6B7280',  // gri — ikincil bilgi
  textTertiary: '#9CA3AF',   // daha soluk — placeholder, ipucu
  textOnPrimary: '#FFFFFF',  // primary zemin üstünde metin
  textOnDark: '#FFFFFF',

  // === SINIR ===
  border: '#E5E7EB',         // subtle — sert çizgi yok
  borderStrong: '#D1D5DB',   // daha belirgin, ayırıcı
  borderFocus: '#4F46E5',    // input focus

  // === ÖZEL ===
  demo: '#F59E0B',    // demo grup badge
  pro: '#7C3AED',     // pro rozet
  skeleton: '#E5E7EB', // loading skeleton

  // === GÖLGE ===
  shadowColor: '#4F46E5',
  shadowColorNeutral: '#000000',
} as const;

export const Typography = {
  // === FONT AİLELERİ ===
  fontDisplay: 'PlusJakartaSans_700Bold',
  fontDisplayBold: 'PlusJakartaSans_800ExtraBold',
  fontDisplayMedium: 'PlusJakartaSans_600SemiBold',
  fontBody: 'Inter_400Regular',
  fontBodyMedium: 'Inter_500Medium',
  fontBodyBold: 'Inter_600SemiBold',

  // === BOYUT SKALASI ===
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 30,
    '3xl': 36,
    '4xl': 48,
  } as const,

  // === SATIR YÜKSEKLİĞİ ===
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  } as const,

  // === HARF ARALIĞI ===
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
  } as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,

  // Özel kullanım
  screenPadding: 16,
  cardPadding: 16,
  sectionGap: 24,
  itemGap: 12,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  } as const,
  md: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  } as const,
  lg: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 8,
  } as const,
  fab: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 16,
    elevation: 12,
  } as const,
};

export const Animation = {
  fast: 150,
  normal: 250,
  slow: 350,
  spring: { damping: 15, stiffness: 150 } as const,
} as const;

// ── Geriye dönük uyumluluk alias'ları (mevcut ekranlar kırılmasın) ──

/** @deprecated Use Colors.background instead */
export const palette = {
  primary: Colors.primary,
  primaryLight: Colors.primaryLight,
  primaryDark: Colors.primaryDark,
  background: Colors.background,
  surface: Colors.backgroundSecondary,
  text: Colors.textPrimary,
  textSecondary: Colors.textSecondary,
  muted: Colors.textTertiary,
  border: Colors.border,
  success: Colors.credit,
  danger: Colors.debt,
  warning: Colors.warning,
} as const;

/** @deprecated Use Spacing instead */
export const spacing = { ...Spacing, xxl: Spacing['4xl'] };

/** @deprecated Use Typography.size instead */
export const fontSizes = {
  xs: Typography.size.xs,
  sm: Typography.size.sm,
  md: Typography.size.md,
  lg: Typography.size.lg,
  xl: Typography.size.md,
  xxl: Typography.size.lg,
  xxxl: Typography.size['2xl'],
} as const;

/** @deprecated Use Radius instead */
export const radii = {
  sm: Radius.sm,
  md: Radius.md,
  lg: Radius.lg,
  xl: Radius.xl,
  full: Radius.full,
} as const;

/** @deprecated Use shared hitSlop or inline */
export const hitSlop = {
  top: 12,
  bottom: 12,
  left: 12,
  right: 12,
} as const;

/** @deprecated Use minHeight on touch targets instead */
export const minTouchTarget = 44;

// Birleşik export
export const Theme = {
  colors: Colors,
  typography: Typography,
  spacing: Spacing,
  radius: Radius,
  shadows: Shadows,
  animation: Animation,
};

export default Theme;
