import { useEffect, useCallback } from 'react';
import { View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';

import '../lib/i18n';
import { AuthProvider, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase/client';
import { initRevenueCat } from '@/lib/revenuecat';

// Prevent auto-hide until fonts are loaded
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

function SupabaseCheck() {
  useEffect(() => {
    supabase.auth.getSession().then(({ error }) => {
      if (error) {
        console.warn('[supabase] Connection check failed:', error.message);
      }
    });
  }, []);

  return null;
}

/**
 * Initialize RevenueCat after auth is ready.
 * Safe in Expo Go — falls back gracefully.
 */
function RevenueCatInit() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      initRevenueCat(user.id);
    }
  }, [user?.id]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SupabaseCheck />
          <RevenueCatInit />
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="paywall" options={{ headerShown: true, title: 'Pro', headerTintColor: '#4F46E5', headerTitleStyle: { color: '#111827', fontWeight: '600' }, presentation: 'modal' }} />
            <Stack.Screen name="dashboard" options={{ headerShown: true, title: 'Dashboard', headerBackTitle: 'Geri', headerTintColor: '#4F46E5', headerTitleStyle: { color: '#111827', fontWeight: '600' } }} />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </View>
  );
}
