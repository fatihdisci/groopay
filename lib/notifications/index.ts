// ──────────────────────────────────────
// Push notification infrastructure
// ⚠️ Expo Go does NOT support remote push notifications.
// Push tokens work in development builds (EAS Build / expo-dev-client).
// This code is ready for dev builds (Phase 8).
// On Expo Go: registerForPushNotificationsAsync returns null → silently skipped.
// ──────────────────────────────────────

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase/client';

/**
 * Request push notification permission and register the device token.
 * On Expo Go: likely returns null or throws — handled gracefully.
 * On dev build: returns the Expo push token string.
 *
 * Call this after successful sign-in.
 */
export async function registerPushToken(userId: string): Promise<void> {
  try {
    // Check if notifications are available (Expo Go may not support)
    if (!Notifications.getExpoPushTokenAsync) {
      console.log('[push] Notifications not available (likely Expo Go)');
      return;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[push] Permission denied');
      return;
    }

    // Android channel (required for Android)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Groopay',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });

    const token = tokenData.data;
    console.log('[push] Token received:', token);

    // Save token to profile
    const { error } = await supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('id', userId);

    if (error) {
      console.warn('[push] Failed to save token:', error.message);
    }
  } catch (err) {
    // Expo Go or other errors — never crash the app
    console.log('[push] Registration failed (expected in Expo Go):', err);
  }
}

/**
 * Set up notification handler (foreground behavior).
 */
export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Call the send-push Edge Function to send a push notification.
 * On Expo Go: silently fails (no push token → Edge Function returns no_push_token).
 *
 * @param userId - Target user's Supabase auth.uid()
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Optional deep-link payload (e.g. { groupId, type })
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  try {
    const fnUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-push`;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ userId, title, body, data }),
    });

    const json = await res.json();
    if (!res.ok) {
      console.warn('[push] send-push failed:', json.error ?? res.status);
    }
  } catch (err) {
    // Never crash the app for push failures
    console.log('[push] send-push call failed:', err);
  }
}

/**
 * Convenience: send a payment reminder push to a debtor.
 */
export async function remindDebtor(
  debtorUserId: string,
  groupName: string,
  amount: string,
  currency: string,
): Promise<void> {
  await sendPushToUser(
    debtorUserId,
    '💸 Ödeme Hatırlatması',
    `${groupName} grubunda ${amount} ${currency} borcun var. Ödemeyi unutma!`,
    { type: 'reminder', groupName },
  );
}
