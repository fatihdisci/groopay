import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Auth client: OAuth and user verification only.
export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    flowType: 'implicit',
  },
});

// ── Module-level token holder ──
// The accessToken callback below injects this as Authorization: Bearer
// on every Supabase request. This means auth.uid() = token's sub claim,
// RLS policies work, and we NEVER call setSession/getSession (which hang).
let currentAccessToken: string | null = null;

export function setSupabaseAccessToken(token: string | null): void {
  currentAccessToken = token;
}

export function getSupabaseAccessToken(): string | null {
  return currentAccessToken;
}

// ── Storage keys for manual persistence ──
export const STORAGE_KEY_ACCESS_TOKEN = 'groopay-access-token';
export const STORAGE_KEY_REFRESH_TOKEN = 'groopay-refresh-token';
export const STORAGE_KEY_TOKEN_EXPIRES_AT = 'groopay-token-expires-at';

// Keep the SB key for backward compatibility with any stored sessions
export const SUPABASE_STORAGE_KEY = (() => {
  const ref = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1] ?? '';
  return `sb-${ref}-auth-token`;
})();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  // accessToken callback: Supabase calls this before every request to get
  // the current token. This completely bypasses setSession/getSession —
  // the token flows directly from our state into the Authorization header.
  accessToken: async () => {
    // Check module-level holder first (set during sign-in)
    if (currentAccessToken) return currentAccessToken;
    // Fallback: read from AsyncStorage (cold start before mount sets it)
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_ACCESS_TOKEN);
      if (stored) {
        currentAccessToken = stored;
        return stored;
      }
    } catch { /* ignore */ }
    return '';
  },
});
