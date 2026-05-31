import { Stack } from 'expo-router';
import { Colors, Typography } from '@/constants/theme';

/**
 * Stack layout for the Groups tab.
 * Groups list → Group detail → modals (add-expense, members, edit).
 * Header style matches Tabs header exactly — same font, color, size, border.
 */
export default function GroupsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { fontFamily: Typography.fontDisplayMedium, color: Colors.textPrimary, fontSize: Typography.size.lg },
        headerTintColor: Colors.primary,
        headerBackTitle: 'Geri',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Grup Detayı' }} />
      <Stack.Screen name="[id]/add-expense" options={{ title: 'Masraf Ekle', presentation: 'modal' }} />
      <Stack.Screen name="[id]/members" options={{ title: 'Üyeler', presentation: 'modal' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Grubu Düzenle' }} />
    </Stack>
  );
}
