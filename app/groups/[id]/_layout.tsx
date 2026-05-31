import { Stack } from 'expo-router';
import { Colors, Typography } from '@/constants/theme';

export default function GroupDetailLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { fontFamily: Typography.fontDisplayMedium, color: Colors.textPrimary, fontSize: Typography.size.lg },
        headerTintColor: Colors.primary,
        headerBackTitle: 'Geri',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Grup Detayı' }} />
      <Stack.Screen name="add-expense" options={{ title: 'Masraf Ekle', presentation: 'modal' }} />
      <Stack.Screen name="members" options={{ title: 'Üyeler', presentation: 'modal' }} />
      <Stack.Screen name="edit" options={{ title: 'Grubu Düzenle' }} />
    </Stack>
  );
}
