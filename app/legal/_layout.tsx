import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Colors, Typography } from '@/constants/theme';

export default function LegalLayout() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.primary,
        headerShadowVisible: true,
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="chevron-back" size={28} color={Colors.primary} />
          </TouchableOpacity>
        ),
        headerTitleStyle: {
          fontFamily: Typography.fontDisplayMedium,
          color: Colors.textPrimary,
        },
      }}
    >
      <Stack.Screen name="privacy" options={{ title: t('legal.privacy.title') }} />
      <Stack.Screen name="terms" options={{ title: t('legal.terms.title') }} />
    </Stack>
  );
}
