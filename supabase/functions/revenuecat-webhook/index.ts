// ──────────────────────────────────────────
// revenuecat-webhook — Supabase Edge Function
// Faz 7: RevenueCat'ten gelen satın alma/iptal
// olaylarını alır, doğrular, DB'ye yazar.
//
// ✅ User Pro event → profiles.user_pro = true
// ✅ Group Pro event → metadata'daki group_id ile
//    groups.is_pro = true, pro_purchased_by, pro_purchased_at yaz.
//
// Güvenlik: RevenueCat Authorization header doğrulanır.
// ──────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const REVENUECAT_AUTH_HEADER = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';

interface RevenueCatEvent {
  event: {
    id: string;
    type: string; // 'INITIAL_PURCHASE', 'RENEWAL', 'CANCELLATION', 'EXPIRATION', etc.
    app_id: string;
    product_id: string;
    entitlement_ids?: string[];
    subscriber: {
      app_user_id: string;
      original_app_user_id: string;
      attributes?: Record<string, string>;
    };
    purchased_at_ms: number;
    expiration_at_ms?: number;
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
    // ── 1. Auth check ──
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');

    if (!REVENUECAT_AUTH_HEADER || token !== REVENUECAT_AUTH_HEADER) {
      console.warn('[rc-webhook] Unauthorized — token mismatch');
      return json({ success: false, error: 'unauthorized' }, 401);
    }

    // ── 2. Parse event ──
    const body: RevenueCatEvent = await req.json();
    const event = body.event;
    if (!event) {
      return json({ success: false, error: 'missing event' }, 400);
    }

    console.log('[rc-webhook] Event received:', event.type, '| app_user_id:', event.subscriber.app_user_id);

    // Only process purchase events
    const purchaseEvents = ['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE'];
    if (!purchaseEvents.includes(event.type)) {
      console.log('[rc-webhook] Skipping non-purchase event:', event.type);
      return json({ success: true, action: 'skipped', reason: `event type: ${event.type}` });
    }

    // ── 3. Service-role client (RLS baypas) ──
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const entitlements = event.entitlement_ids ?? [];
    const appUserId = event.subscriber.app_user_id;

    // ── 4. Process User Pro ──
    if (entitlements.includes('user_pro')) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          user_pro: true,
          user_pro_purchased_at: new Date(event.purchased_at_ms).toISOString(),
        })
        .eq('id', appUserId);

      if (updateError) {
        console.error('[rc-webhook] Failed to update profile.user_pro:', updateError.message);
        return json({ success: false, error: updateError.message }, 500);
      }

      console.log('[rc-webhook] ✅ User Pro activated for', appUserId);
      return json({ success: true, action: 'user_pro_activated', user_id: appUserId });
    }

    // ── 5. Process Group Pro ──
    if (entitlements.includes('group_pro')) {
      const groupId = event.subscriber.attributes?.group_id;
      if (!groupId) {
        console.warn('[rc-webhook] Group Pro event without group_id attribute. app_user_id:', appUserId);
        return json({ success: false, error: 'missing group_id attribute' }, 400);
      }

      // Verify the group exists
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id, is_pro')
        .eq('id', groupId)
        .single();

      if (groupError || !group) {
        console.error('[rc-webhook] Group not found:', groupId);
        return json({ success: false, error: 'group not found' }, 404);
      }

      // Idempotent: only update if not already Pro (or update timestamp)
      const { error: updateError } = await supabase
        .from('groups')
        .update({
          is_pro: true,
          pro_purchased_by: appUserId,
          pro_purchased_at: new Date(event.purchased_at_ms).toISOString(),
        })
        .eq('id', groupId);

      if (updateError) {
        console.error('[rc-webhook] Failed to update groups.is_pro:', updateError.message);
        return json({ success: false, error: updateError.message }, 500);
      }

      console.log('[rc-webhook] ✅ Group Pro activated for group:', groupId, '| purchased by:', appUserId);
      return json({ success: true, action: 'group_pro_activated', group_id: groupId });
    }

    // ── 6. Unknown entitlement ──
    console.log('[rc-webhook] Unknown entitlement(s):', entitlements.join(', '));
    return json({ success: true, action: 'skipped', reason: 'unknown entitlement(s)' });

  } catch (err: any) {
    console.error('[rc-webhook] Unexpected error:', err);
    return json({ success: false, error: err?.message ?? 'internal server error' }, 500);
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
