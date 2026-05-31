import { Stack, router } from 'expo-router';
import { TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
      <Stack.Screen
        name="index"
        options={{
          title: 'Grup Detayı',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: -8, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chevron-back" size={24} color={Colors.primary} />
              <Text style={{ fontFamily: Typography.fontBody, fontSize: 17, color: Colors.primary, marginLeft: -2 }}>Geri</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen name="add-expense" options={{ title: 'Masraf Ekle', presentation: 'modal' }} />
      <Stack.Screen name="members" options={{ title: 'Üyeler', presentation: 'modal' }} />
      <Stack.Screen name="edit" options={{ title: 'Grubu Düzenle' }} />
    </Stack>
  );
}
