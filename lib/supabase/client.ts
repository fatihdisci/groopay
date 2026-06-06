import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Extract project ref from URL for manual storage key (fallback)
const SUPABASE_PROJECT_REF = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1] ?? '';
export const SUPABASE_STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // On web, Supabase uses localStorage by default. On native,
    // we must provide AsyncStorage for session persistence.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    // autoRefreshToken: false because the internal refresh API call hangs
    // on React Native (setSession/getSession deadlock). We handle token
    // storage manually and rely on the session's expires_at for validity.
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: false,
    // Implicit flow: tokens are returned in the URL fragment (#access_token=...)
    // on native. We handle this manually in AuthContext because React Native
    // lacks WebCrypto for PKCE SHA256 (falls back to plain, which may hang).
    flowType: 'implicit',
  },
});
