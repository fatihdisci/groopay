// constants/styles.ts
// Groopay shared styles — ekranlarda import edilir
import { StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadows } from './theme';

export const SharedStyles = StyleSheet.create({
  // === EKRAN KONTEYNER ===
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenPadded: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.screenPadding,
  },

  // === KARTLAR ===
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.cardPadding,
    ...Shadows.md,
  },
  cardTinted: {
    backgroundColor: Colors.surfaceTinted,
    borderRadius: Radius.lg,
    padding: Spacing.cardPadding,
  },

  // === TİPOGRAFİ ===
  // Rakam gösterimi — Plus Jakarta Sans ile
  amountLarge: {
    fontFamily: Typography.fontDisplayBold,
    fontSize: Typography.size['3xl'],
    letterSpacing: Typography.letterSpacing.tight,
    color: Colors.textPrimary,
  },
  amountMedium: {
    fontFamily: Typography.fontDisplay,
    fontSize: Typography.size.xl,
    letterSpacing: Typography.letterSpacing.tight,
    color: Colors.textPrimary,
  },
  amountSmall: {
    fontFamily: Typography.fontDisplayMedium,
    fontSize: Typography.size.md,
    color: Colors.textPrimary,
  },
  // Başlıklar
  heading1: {
    fontFamily: Typography.fontDisplayBold,
    fontSize: Typography.size.xl,
    letterSpacing: Typography.letterSpacing.tight,
    color: Colors.textPrimary,
  },
  heading2: {
    fontFamily: Typography.fontDisplay,
    fontSize: Typography.size.lg,
    letterSpacing: Typography.letterSpacing.tight,
    color: Colors.textPrimary,
  },
  heading3: {
    fontFamily: Typography.fontDisplayMedium,
    fontSize: Typography.size.md,
    color: Colors.textPrimary,
  },
  // Body
  bodyLarge: {
    fontFamily: Typography.fontBodyMedium,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
  },
  body: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
  },
  bodySmall: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
  caption: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  // Label (UPPERCASE) — toLocaleUpperCase('tr-TR') ile kullan
  label: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    letterSpacing: Typography.letterSpacing.wider,
  },

  // === BUTONLAR ===
  buttonPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 52,
    ...Shadows.md,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 52,
  },
  buttonText: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.base,
    color: Colors.textOnPrimary,
  },
  buttonTextSecondary: {
    fontFamily: Typography.fontBodyBold,
    fontSize: Typography.size.base,
    color: Colors.primary,
  },
  buttonDestructive: {
    backgroundColor: Colors.debtLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center' as const,
    minHeight: 52,
  },

  // === AYRAÇ ===
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },

  // === SEMANTİK YARDIMCILAR ===
  creditText: {
    color: Colors.credit,
    fontFamily: Typography.fontDisplayMedium,
  },
  debtText: {
    color: Colors.debt,
    fontFamily: Typography.fontDisplayMedium,
  },
  primaryText: {
    color: Colors.primary,
  },
});
