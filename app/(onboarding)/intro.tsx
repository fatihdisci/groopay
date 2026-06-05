import { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { createDemoGroup } from '@/lib/supabase/queries';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingStep {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  descriptionKey: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: 'pie-chart-outline',
    titleKey: 'onboarding.step1.title',
    descriptionKey: 'onboarding.step1.description',
  },
  {
    icon: 'people-outline',
    titleKey: 'onboarding.step2.title',
    descriptionKey: 'onboarding.step2.description',
  },
  {
    icon: 'notifications-outline',
    titleKey: 'onboarding.step3.title',
    descriptionKey: 'onboarding.step3.description',
  },
];

export default function IntroScreen() {
  const { t } = useTranslation();
  const { user, setOnboarded } = useAuth();
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const flatListRef = useRef<FlatList<OnboardingStep>>(null);

  const handleGetStarted = async () => {
    if (!user || isCreating) return;
    setIsCreating(true);
    try {
      await createDemoGroup(user.id);
    } catch (e) {
      console.warn('[onboarding] Failed to create demo group:', e);
    }
    await setOnboarded();
    router.replace('/(tabs)/groups');
  };

  const handleSkip = async () => {
    await setOnboarded();
    router.replace('/(tabs)/groups');
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(idx);
  };

  const isLastSlide = currentIndex === STEPS.length - 1;

  const renderItem = ({ item }: { item: OnboardingStep }) => (
    <View style={styles.slide}>
      <View style={styles.iconCircle}>
        <Ionicons name={item.icon} size={48} color="#FFFFFF" />
      </View>
      <Text style={styles.slideTitle}>{t(item.titleKey)}</Text>
      <Text style={styles.slideDescription}>{t(item.descriptionKey)}</Text>
    </View>
  );

  return (
    <LinearGradient
      colors={['#4F46E5', '#7C3AED']}
      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <StatusBar style="light" />

      {/* Skip button */}
      {!isCreating && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.skip')}
        >
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={STEPS}
        renderItem={renderItem}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      />

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === currentIndex ? '#FFFFFF' : 'rgba(255,255,255,0.35)' },
            ]}
          />
        ))}
      </View>

      {/* Bottom button */}
      <View style={styles.bottom}>
        <TouchableOpacity
          style={[styles.button, isCreating && styles.buttonDisabled]}
          onPress={isLastSlide ? handleGetStarted : () => {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
          }}
          activeOpacity={0.7}
          disabled={isCreating}
          accessibilityRole="button"
          accessibilityLabel={isLastSlide ? t('onboarding.getStarted') : t('onboarding.next')}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.buttonText}>
              {isLastSlide ? t('onboarding.getStarted') : t('onboarding.next')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipButton: { position: 'absolute', top: 60, right: Spacing.lg, zIndex: 10 },
  skipText: { fontFamily: Typography.fontBodyMedium, fontSize: Typography.size.base, color: 'rgba(255,255,255,0.7)' },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  iconCircle: {
    width: 100, height: 100, borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing['2xl'],
  },
  slideTitle: {
    fontFamily: Typography.fontDisplayBold,
    fontSize: Typography.size.xl,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: Typography.letterSpacing.tight,
    marginBottom: Spacing.md,
  },
  slideDescription: {
    fontFamily: Typography.fontBody,
    fontSize: Typography.size.base,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: Typography.size.base * 1.6,
  },
  pagination: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, paddingBottom: Spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bottom: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['4xl'] },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md + 2,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonText: { fontFamily: Typography.fontBodyBold, fontSize: Typography.size.base, color: Colors.primary },
  buttonDisabled: { opacity: 0.6 },
});
