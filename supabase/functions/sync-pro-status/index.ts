// ──────────────────────────────────────────
// sync-pro-status — Supabase Edge Function
// B130: Webhook'tan bağımsız, pull-based Pro doğrulama.
//
// Kullanıcının JWT'siyle çağrılır; sunucu RevenueCat REST API'den
// o kullanıcının entitlement durumunu okur ve profiles.user_pro'yu set eder.
// Hangi webhook event'i kaçarsa kaçsın, "Satın alımları geri yükle"
// her zaman doğru sonuca ulaşır.
//
// verify_jwt AÇIK (default) — Authorization: Bearer <user JWT> zorunlu.
// Gerekli secret: REVENUECAT_SECRET_API_KEY (RC dashboard → API Keys → sk_…)
// ──────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const USER_PRO_ENTITLEMENT_ID = 'user_pro';
const USER_PRO_PRODUCT_ID = 'com.groopay.app.userpro';

interface RcEntitlement {
  expires_date: string | null;
  purchase_date?: string;
}

interface RcSubscription {
  expires_date: string | null;
  unsubscribe_detected_at?: string | null;
}

interface RcSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, RcEntitlement>;
    subscriptions?: Record<string, RcSubscription>;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization,content-type',
      },
    });
  }

  try {
    // ── 1. Resolve user from JWT ──
    const authHeader = req.headers.get('authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) {
      return json({ success: false, error: 'unauthorized' }, 401);
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const { data: userData, error: userError } = await anonClient.auth.getUser(jwt);
    const userId = userData?.user?.id;
    if (userError || !userId) {
      console.warn('[sync-pro] invalid JWT');
      return json({ success: false, error: 'unauthorized' }, 401);
    }
    console.log('[sync-pro] user:', userId);

    // ── 2. Query RevenueCat REST API ──
    const rcApiKey = Deno.env.get('REVENUECAT_SECRET_API_KEY') ?? '';
    if (!rcApiKey) {
      console.error('[sync-pro] REVENUECAT_SECRET_API_KEY not configured');
      return json({ success: false, error: 'revenuecat_unreachable' }, 502);
    }

    let rcResponse: Response;
    try {
      rcResponse = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
        { headers: { Authorization: `Bearer ${rcApiKey}` } },
      );
    } catch (fetchError) {
      console.error('[sync-pro] RC fetch failed:', fetchError);
      return json({ success: false, error: 'revenuecat_unreachable' }, 502);
    }

    if (!rcResponse.ok) {
      console.error('[sync-pro] rc status:', rcResponse.status);
      return json({ success: false, error: 'revenuecat_unreachable' }, 502);
    }

    const rcBody: RcSubscriberResponse = await rcResponse.json();
    const subscriber = rcBody.subscriber;
    console.log('[sync-pro] rc status: ok');

    // ── 3. Pro detection — entitlement OR subscription suffices ──
    const now = new Date();
    const entitlement = subscriber?.entitlements?.[USER_PRO_ENTITLEMENT_ID];
    const subscription = subscriber?.subscriptions?.[USER_PRO_PRODUCT_ID];

    const entitlementActive = entitlement != null
      && entitlement.expires_date != null
      && new Date(entitlement.expires_date) > now;

    // iptal ≠ erişim kaybı: unsubscribe_detected_at dolu olsa bile
    // süre geçmediyse aktif say
    const subscriptionActive = subscription != null
      && subscription.expires_date != null
      && new Date(subscription.expires_date) > now;

    const isPro = entitlementActive || subscriptionActive;
    const expiresAt = entitlementActive
      ? entitlement!.expires_date
      : subscriptionActive
        ? subscription!.expires_date
        : null;
    console.log('[sync-pro] entitlement expires:', expiresAt ?? 'none', '| pro:', isPro);

    // ── 4. Update profiles with service role ──
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const update: Record<string, unknown> = { user_pro: isPro };
    if (isPro && entitlement?.purchase_date) {
      update.user_pro_purchased_at = entitlement.purchase_date;
    }

    const { error: updateError } = await serviceClient
      .from('profiles')
      .update(update)
      .eq('id', userId);

    if (updateError) {
      console.error('[sync-pro] db update failed:', updateError.message);
      return json({ success: false, error: updateError.message }, 500);
    }
    console.log('[sync-pro] db updated | user_pro:', isPro);

    return json({ success: true, user_pro: isPro, expires_at: expiresAt });
  } catch (err: unknown) {
    console.error('[sync-pro] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'internal server error';
    return json({ success: false, error: message }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
