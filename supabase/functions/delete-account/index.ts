// delete-account — Supabase Edge Function
// Account deletion required by Apple.
//
// User-scoped client: calls delete_user_data so auth.uid() is populated.
// Service-role client: deletes the auth.users row after database cleanup.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED', message: 'method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({
        error: 'MISSING_AUTHORIZATION',
        message: 'missing authorization header',
      }, 401);
    }
    const accessToken = authHeader.slice('Bearer '.length);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error('[delete-account] Missing Supabase environment variables');
      return json({
        error: 'SERVER_CONFIGURATION_ERROR',
        message: 'account deletion is temporarily unavailable',
      }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Verify the caller before passing their ID into the SECURITY DEFINER RPC.
    const { data: { user }, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !user) {
      console.warn('[delete-account] Invalid auth token:', userError?.message);
      return json({ error: 'INVALID_AUTH_TOKEN', message: 'invalid auth token' }, 401);
    }

    // Database cleanup is atomic inside delete_user_data. This must use the
    // caller's Authorization header so auth.uid() equals target_user_id.
    const { error: cleanupError } = await userClient.rpc('delete_user_data', {
      target_user_id: user.id,
    });

    if (cleanupError) {
      const founderGroups = parseFounderGroups(cleanupError.message);
      if (founderGroups) {
        return json({
          error: 'FOUNDER_GROUPS_EXIST',
          message: `Aşağıdaki gruplarda kurucusunuz: ${founderGroups}. Her birinde yönetimi devredin ya da grubu silin.`,
          groups: founderGroups.split(',').map((name) => ({ name: name.trim() })),
        }, 409);
      }

      if (cleanupError.message.includes('UNAUTHORIZED')) {
        return json({
          error: 'UNAUTHORIZED',
          message: 'account deletion is not authorized',
        }, 403);
      }

      console.error('[delete-account] Database cleanup failed:', cleanupError);
      return json({
        error: 'DATA_CLEANUP_FAILED',
        message: 'account data could not be deleted',
      }, 500);
    }

    // The RPC is idempotent. If this step fails, retrying account deletion
    // reruns cleanup safely and then retries deletion of the auth user.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('[delete-account] Auth user deletion failed:', deleteError);
      return json({
        error: 'AUTH_USER_DELETE_FAILED',
        message: 'account data was deleted, but the login record could not be removed; please retry',
      }, 500);
    }

    return json({ success: true });
  } catch (error: unknown) {
    console.error('[delete-account] Unexpected error:', error);
    return json({
      error: 'INTERNAL_SERVER_ERROR',
      message: getErrorMessage(error),
    }, 500);
  }
});

function parseFounderGroups(message: string): string | null {
  const marker = 'FOUNDER_GROUPS_EXIST:';
  const markerIndex = message.indexOf(marker);
  if (markerIndex < 0) return null;

  const groupNames = message.slice(markerIndex + marker.length).trim();
  return groupNames || null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'internal server error';
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}
