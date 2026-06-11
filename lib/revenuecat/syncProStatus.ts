// ──────────────────────────────────────
// B130: Pull-based Pro doğrulama.
// sync-pro-status Edge Function'ını kullanıcı JWT'siyle çağırır;
// sunucu RevenueCat REST API'den durumu okur ve profiles.user_pro'yu set eder.
// Webhook'tan kaçan event'lere karşı deterministik senkron yol.
// ──────────────────────────────────────

import { supabase } from '@/lib/supabase/client';

interface SyncProStatusResponse {
  success: boolean;
  user_pro?: boolean;
  expires_at?: string | null;
}

export async function syncProStatus(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke<SyncProStatusResponse>('sync-pro-status');
    if (error) {
      console.log('[sync-pro] invoke error:', error.message);
      return false;
    }
    console.log('[sync-pro] result:', data?.user_pro);
    return data?.user_pro === true;
  } catch (e) {
    console.log('[sync-pro] failed:', e);
    return false;
  }
}
