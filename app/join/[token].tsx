import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { palette, fontSizes, spacing } from '@/constants/theme';

// Deep link handler: groopay://join/TOKEN
// Just redirects to the join screen with the code pre-filled.
// Expo Go'da tam deep link çalışmayabilir; manuel kod girişi ana yol.
export default function JoinTokenScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

  useEffect(() => {
    // Navigate to join screen — token will be passed
    router.replace(`/join?token=${token ?? ''}`);
  }, [token, router]);

  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={palette.primary} />
      <Text style={styles.text}>Açılıyor...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  text: { marginTop: spacing.md, fontSize: fontSizes.md, color: palette.textSecondary },
});
