import { Stack } from 'expo-router';
import { palette } from '@/constants/theme';

// Header is handled by the root Stack (back to tabs).
// Inner Stack: members modal + add-expense modal.
// (save to trigger Metro rebuild — add-expense route)
export default function GroupDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-expense"
        options={{
          headerShown: true,
          title: 'Masraf Ekle',
          presentation: 'modal',
          headerStyle: { backgroundColor: palette.background },
          headerTitleStyle: { color: palette.text, fontWeight: '600' },
          headerTintColor: palette.primary,
        }}
      />
      <Stack.Screen
        name="members"
        options={{
          headerShown: true,
          title: 'Üyeler',
          presentation: 'modal',
          headerStyle: { backgroundColor: palette.background },
          headerTitleStyle: { color: palette.text, fontWeight: '600' },
          headerTintColor: palette.primary,
        }}
      />
    </Stack>
  );
}
