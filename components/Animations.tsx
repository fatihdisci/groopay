import { useEffect, useRef } from 'react';
import { Animated, AccessibilityInfo, Pressable, View } from 'react-native';

/**
 * FadeInUp — wraps children in a fade-in + slide-up entrance animation.
 * Runs once on mount. Respects prefers-reduced-motion.
 */
export function FadeInUp({
  children,
  delay = 0,
  duration = 300,
  distance = 12,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        opacity.setValue(1);
        translateY.setValue(0);
        return;
      }
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          delay,
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => { cancelled = true; };
  }, [opacity, translateY, delay, duration]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

/**
 * ScaleOnPress — wraps children in a scale-down-on-press animation.
 * Light touch feedback: scales to 0.97 on press, springs back on release.
 */
export function ScaleOnPress({
  children,
  onPress,
  disabled,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 2,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
      >
        {children}
      </AnimatedPressable>
    </Animated.View>
  );
}

function AnimatedPressable({
  children,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
    >
      <View>{children}</View>
    </Pressable>
  );
}
