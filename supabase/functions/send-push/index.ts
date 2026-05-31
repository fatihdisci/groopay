// ──────────────────────────────────────────
// send-push — Supabase Edge Function
// Faz 6: Expo Push API'ye HTTP isteği gönderir.
// Çağrı: client-side (mutation sonrası) veya DB webhook.
//
// Deploy: Supabase Dashboard → Edge Functions
//   supabase functions deploy send-push
//
// ⚠️ Expo Go'da push token ALINAMAZ.
//    Bu fonksiyon dev build (Faz 8) ile aktif olur.
// ──────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface PushRequest {
  // Option A: userId → lookup expo_push_token from profiles
  userId?: string;
  // Option B: direct token
  pushToken?: string;
  // Notification content
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface ExpoPushMessage {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization,content-type',
        'Access-Control-Allow-Methods': 'POST',
      },
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }

  try {
    const body: PushRequest = await req.json();
    const { userId, pushToken: directToken, title, body: messageBody, data } = body;

    if (!title || !messageBody) {
      return json({ error: 'title and body are required' }, 400);
    }

    let token = directToken;

    // If no direct token, look up from profiles
    if (!token && userId) {
      const authHeader = req.headers.get('authorization');

      // Use service-role if available (for webhook calls), else user's own token
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('expo_push_token')
        .eq('id', userId)
        .single();

      if (profileErr) {
        console.warn('[send-push] Profile not found for userId:', userId);
        return json({ error: 'user not found' }, 404);
      }

      if (!profile?.expo_push_token) {
        console.log('[send-push] No push token for userId:', userId);
        return json({ success: false, reason: 'no_push_token' });
      }

      token = profile.expo_push_token;
    }

    if (!token) {
      return json({ error: 'no push token provided or found' }, 400);
    }

    // Build Expo push message
    const message: ExpoPushMessage = {
      to: token,
      sound: 'default',
      title,
      body: messageBody,
      priority: 'high',
      channelId: 'default',
    };

    if (data) {
      message.data = data;
    }

    // Send via Expo Push API
    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify([message]),
    });

    const expoResult = await expoRes.json();
    console.log('[send-push] Expo response:', JSON.stringify(expoResult));

    return json({ success: true, expoResult });
  } catch (err: any) {
    console.error('[send-push]', err);
    return json({ error: err?.message ?? 'internal server error' }, 500);
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
