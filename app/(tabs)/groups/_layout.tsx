import { Stack } from 'expo-router';
import { Colors, Typography } from '@/constants/theme';

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
      <Stack.Screen name="index" options={{ title: 'Gruplar' }} />
      <Stack.Screen name="new" options={{ title: 'Yeni Grup' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Grup Detayı' }} />
      <Stack.Screen name="[id]/add-expense" options={{ title: 'Masraf Ekle', presentation: 'modal' }} />
      <Stack.Screen name="[id]/members" options={{ title: 'Üyeler', presentation: 'modal' }} />
      <Stack.Screen name="[id]/edit" options={{ headerShown: false }} />
    </Stack>
  );
}
