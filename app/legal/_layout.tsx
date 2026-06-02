import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Colors, Typography } from '@/constants/theme';

export default function LegalLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.primary,
        headerShadowVisible: true,
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
