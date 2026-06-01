// ──────────────────────────────────────────
// revenuecat-webhook — Supabase Edge Function
// Faz 7: RevenueCat'ten gelen tüm olayları işler.
//
// ✅ GRANT events (purchase/renewal/uncancel) → user_pro = true
// ✅ REVOKE events (expiration/cancel/refund) → user_pro = false
// ✅ BILLING_ISSUE → log only (grace period sonra)
// ✅ Expiration-based safety net: expiration geçmişse → otomatik false
//
// Güvenlik: RevenueCat Authorization header doğrulanır.
// ──────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const REVENUECAT_AUTH_HEADER = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';

// ── Event type classification ──

/** Bu event'ler Pro erişimi AKTİF yapar */
const GRANT_EVENTS = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'NON_RENEWING_PURCHASE',
  'UNCANCELLATION',       // iptal geri alındı
  'PRODUCT_CHANGE',       // plan değişikliği — aktif kalır
];

/** Bu event'ler Pro erişimini KALDIRIR */
const REVOKE_EVENTS = [
  'EXPIRATION',           // abonelik süresi doldu
  'CANCELLATION',         // kullanıcı iptal etti
  'REFUND',               // para iadesi
  'SUBSCRIPTION_PAUSED',  // duraklatıldı
];

/** Bu event şimdilik sadece loglanır, user_pro'ya dokunulmaz */
const BILLING_ISSUE_EVENT = 'BILLING_ISSUE';

interface RevenueCatEvent {
  event: {
    id: string;
    type: string;
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

    const eventType = event.type;
    const appUserId = event.subscriber.app_user_id;
    const entitlements = event.entitlement_ids ?? [];
    const expirationMs = event.expiration_at_ms;
    const nowMs = Date.now();

    console.log('[rc-webhook] Event:', eventType, '| user:', appUserId, '| entitlements:', entitlements.join(', '));

    // ── 3. Classify event ──
    const isGrant = GRANT_EVENTS.includes(eventType);
    const isRevoke = REVOKE_EVENTS.includes(eventType);
    const isBillingIssue = eventType === BILLING_ISSUE_EVENT;

    // ── 4. Expiration safety net ──
    // If expiration_ms exists and is in the past → force revoke
    // (defensive: catches edge cases where GRANT event fires but entitlement already expired)
    const expired = expirationMs != null && expirationMs <= nowMs;

    // Determine effective action
    let action: 'grant' | 'revoke' | 'log_only' | 'skip';

    if (isBillingIssue) {
      action = 'log_only';
    } else if (isRevoke || expired) {
      action = 'revoke';
    } else if (isGrant) {
      action = 'grant';
    } else {
      action = 'skip';
    }

    console.log('[rc-webhook] Action:', action, '| expired:', expired,
      '| expiration_ms:', expirationMs, '| now_ms:', nowMs);

    // ── 5. Skip if nothing to do ──
    if (action === 'skip') {
      console.log('[rc-webhook] Skipping unhandled event type:', eventType);
      return json({ success: true, action: 'skipped', reason: `event type: ${eventType}` });
    }

    // ── 6. Service-role client (RLS bypass) ──
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 7. Process User Pro ──
    if (entitlements.includes('user_pro')) {
      if (action === 'grant') {
        // Aktif et
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            user_pro: true,
            user_pro_purchased_at: new Date(event.purchased_at_ms).toISOString(),
          })
          .eq('id', appUserId);

        if (updateError) {
          console.error('[rc-webhook] Failed to activate user_pro:', updateError.message);
          return json({ success: false, error: updateError.message }, 500);
        }

        console.log('[rc-webhook] ✅ User Pro ACTIVATED for', appUserId);
        return json({ success: true, action: 'user_pro_activated', user_id: appUserId });
      }

      if (action === 'revoke') {
        // Kaldır
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            user_pro: false,
          })
          .eq('id', appUserId);

        if (updateError) {
          console.error('[rc-webhook] Failed to deactivate user_pro:', updateError.message);
          return json({ success: false, error: updateError.message }, 500);
        }

        console.log('[rc-webhook] ❌ User Pro REVOKED for', appUserId,
          '| reason:', expired ? 'expiration_past' : eventType);
        return json({
          success: true,
          action: 'user_pro_revoked',
          user_id: appUserId,
          reason: expired ? 'expiration_past' : eventType,
        });
      }

      // action === 'log_only' (BILLING_ISSUE)
      console.log('[rc-webhook] ⚠️ Billing issue for', appUserId, '— user_pro unchanged');
      return json({
        success: true,
        action: 'billing_issue_logged',
        user_id: appUserId,
        message: 'user_pro unchanged during billing issue',
      });
    }

    // ── 8. Process Group Pro ──
    if (entitlements.includes('group_pro')) {
      const groupId = event.subscriber.attributes?.group_id;

      if (action === 'grant') {
        if (!groupId) {
          console.warn('[rc-webhook] Group Pro grant without group_id. user:', appUserId);
          return json({ success: false, error: 'missing group_id attribute' }, 400);
        }

        const { data: group, error: groupError } = await supabase
          .from('groups')
          .select('id, is_pro')
          .eq('id', groupId)
          .single();

        if (groupError || !group) {
          console.error('[rc-webhook] Group not found:', groupId);
          return json({ success: false, error: 'group not found' }, 404);
        }

        const { error: updateError } = await supabase
          .from('groups')
          .update({
            is_pro: true,
            pro_purchased_by: appUserId,
            pro_purchased_at: new Date(event.purchased_at_ms).toISOString(),
          })
          .eq('id', groupId);

        if (updateError) {
          console.error('[rc-webhook] Failed to activate group_pro:', updateError.message);
          return json({ success: false, error: updateError.message }, 500);
        }

        console.log('[rc-webhook] ✅ Group Pro ACTIVATED for group:', groupId, '| by:', appUserId);
        return json({ success: true, action: 'group_pro_activated', group_id: groupId });
      }

      if (action === 'revoke') {
        if (!groupId) {
          console.warn('[rc-webhook] Group Pro revoke without group_id. user:', appUserId);
          return json({ success: false, error: 'missing group_id attribute' }, 400);
        }

        const { error: updateError } = await supabase
          .from('groups')
          .update({
            is_pro: false,
          })
          .eq('id', groupId);

        if (updateError) {
          console.error('[rc-webhook] Failed to deactivate group_pro:', updateError.message);
          return json({ success: false, error: updateError.message }, 500);
        }

        console.log('[rc-webhook] ❌ Group Pro REVOKED for group:', groupId,
          '| reason:', expired ? 'expiration_past' : eventType);
        return json({
          success: true,
          action: 'group_pro_revoked',
          group_id: groupId,
          reason: expired ? 'expiration_past' : eventType,
        });
      }

      // action === 'log_only' — billing issue for group
      console.log('[rc-webhook] ⚠️ Billing issue for group:', groupId, '— group_pro unchanged');
      return json({
        success: true,
        action: 'billing_issue_logged',
        group_id: groupId,
        message: 'group_pro unchanged during billing issue',
      });
    }

    // ── 9. Unknown entitlement ──
    console.log('[rc-webhook] Unknown entitlement(s):', entitlements.join(', '),
      '| action:', action);
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
