import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { usePro } from '@/hooks/usePro';
import { palette, spacing, fontSizes, radii, minTouchTarget } from '@/constants/theme';
import type { GroupRow } from '@/lib/supabase/types';

interface ProGateProps {
  /** The group to check Pro status for. If omitted, only user_pro is checked. */
  group?: Pick<GroupRow, 'id' | 'is_pro'>;
  /** Children rendered only if Pro access is granted */
  children: React.ReactNode;
  /** Optional: render a custom locked view instead of the default */
  lockedView?: React.ReactNode;
  /** Optional: hide the lock indicator entirely (just render children or null) */
  hideLock?: boolean;
}

/**
 * ProGate — wraps a feature that requires Pro access.
 *
 * If the user has Pro (via user_pro or group.is_pro), children are rendered.
 * Otherwise, a lock indicator is shown. Tapping it opens the paywall.
 */
export function ProGate({ group, children, lockedView, hideLock }: ProGateProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { hasProAccess } = usePro();

  const isPro = group ? hasProAccess(group) : hasProAccess({ is_pro: false });

  if (isPro) return <>{children}</>;

  if (hideLock) return null;

  if (lockedView) {
    return <>{lockedView}</>;
  }

  const groupId = group?.id;

  return (
    <TouchableOpacity
      style={styles.locked}
      onPress={() =>
        router.push(`/paywall?context=feature${groupId ? `&groupId=${groupId}` : ''}`)
      }
      activeOpacity={0.7}
    >
      <Ionicons name="lock-closed" size={16} color={palette.muted} />
      <Text style={styles.lockedText}>{t('pro.locked')}</Text>
      <View style={styles.upgradeBadge}>
        <Text style={styles.upgradeText}>{t('pro.upgrade')}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * ProBadge — a small "Pro" badge to show on Pro-only features.
 * Subtle visual indicator that this is a Pro feature.
 */
export function ProBadge() {
  const { t } = useTranslation();
  return (
    <View style={styles.badge}>
      <Ionicons name="diamond" size={10} color={palette.primary} />
      <Text style={styles.badgeText}>{t('pro.badge')}</Text>
    </View>
  );
}

/**
 * ProFeatureRow — a menu/list item that may be locked behind Pro.
 * Renders as a tappable row; if Pro is not active, shows lock.
 */
export function ProFeatureRow({
  group,
  icon,
  label,
  onPress,
}: {
  group?: Pick<GroupRow, 'id' | 'is_pro'>;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { hasProAccess } = usePro();

  const isPro = group ? hasProAccess(group) : hasProAccess({ is_pro: false });

  const handlePress = () => {
    if (isPro) {
      onPress?.();
    } else {
      router.push(`/paywall?context=feature${group?.id ? `&groupId=${group.id}` : ''}`);
    }
  };

  return (
    <TouchableOpacity style={styles.featureRow} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.featureRowLeft}>
        <Ionicons name={icon} size={16} color={isPro ? palette.primary : palette.muted} />
        <Text style={[styles.featureRowLabel, !isPro && { color: palette.muted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {isPro ? (
        <Ionicons name="chevron-forward" size={18} color={palette.muted} />
      ) : (
        <ProBadge />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: 'dashed',
    minHeight: minTouchTarget,
  },
  lockedText: {
    flex: 1,
    fontSize: fontSizes.sm,
    color: palette.muted,
    fontWeight: '500',
  },
  upgradeBadge: {
    backgroundColor: palette.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  upgradeText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: palette.primary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: palette.primary + '15',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: palette.primary,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: palette.background,
    borderRadius: radii.sm,
    minHeight: 36,
  },
  featureRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  featureRowLabel: {
    fontSize: fontSizes.sm,
    color: palette.text,
  },
  featureRowLock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
