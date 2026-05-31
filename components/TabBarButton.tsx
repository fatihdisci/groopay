import { useEffect } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Colors } from '@/constants/theme';

interface TabBarButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean };
}

export default function TabBarButton({
  children,
  onPress,
  accessibilityLabel,
  accessibilityState,
}: TabBarButtonProps) {
  const focused = accessibilityState?.selected ?? false;
  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused) {
      scale.value = withSpring(1.08, { stiffness: 400, damping: 12 }, () => {
        scale.value = withSpring(1, { stiffness: 300, damping: 15 });
      });
    }
  }, [focused, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress ?? undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      accessibilityRole="tab"
      style={styles.button}
    >
      <Animated.View style={[styles.inner, animatedStyle]}>
        {children}
      </Animated.View>

      {focused && <Animated.View style={styles.pill} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pill: {
    position: 'absolute',
    bottom: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
});
