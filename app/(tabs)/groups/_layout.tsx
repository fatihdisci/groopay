import { Stack } from 'expo-router';
import { palette, Typography } from '@/constants/theme';

/**
 * Stack layout for the Groups tab.
 * Groups list → Group detail → modals (add-expense, members, edit).
 */
export default function GroupsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTitleStyle: { fontFamily: Typography.fontDisplayMedium, color: palette.text, fontWeight: '600' },
        headerTintColor: palette.primary,
        headerBackTitle: 'Geri',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]/index" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="[id]/add-expense" options={{ title: 'Masraf Ekle', presentation: 'modal' }} />
      <Stack.Screen name="[id]/members" options={{ title: 'Üyeler', presentation: 'modal' }} />
      <Stack.Screen name="[id]/edit" options={{ headerShown: false, animation: 'none' }} />
    </Stack>
  );
}
