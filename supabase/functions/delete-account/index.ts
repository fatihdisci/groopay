// ──────────────────────────────────────────
// delete-account — Supabase Edge Function
// Faz 8: Hesap silme (Apple zorunlu)
// Auth user'ı ve cascade ile tüm verisini siler.
// Service-role ile çalışır → RLS baypas.
// ──────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return json({ error: 'missing authorization header' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Verify the calling user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );

    if (userError || !user) {
      return json({ error: 'invalid auth token' }, 401);
    }

    const userId = user.id;

    // 2. Check for founder groups with other real members
    //    Find groups where this user is founder (created_by)
    //    AND there are other active real members (user_id IS NOT NULL, user_id != this user)
    const { data: founderGroups, error: founderError } = await supabase
      .from('groups')
      .select(`
        id,
        name,
        group_members!inner (
          id,
          user_id,
          is_active
        )
      `)
      .eq('created_by', userId)
      .eq('group_members.is_active', true)
      .neq('group_members.user_id', userId)
      .not('group_members.user_id', 'is', null);

    if (founderError) throw founderError;

    if (founderGroups && founderGroups.length > 0) {
      // There are groups where user is founder with other real members
      const groupNames = founderGroups.map((g: any) => g.name).join(', ');
      return json({
        error: 'FOUNDER_GROUPS_EXIST',
        message: `Aşağıdaki gruplarda kurucusunuz: ${groupNames}. Her birinde yönetimi devredin ya da grubu silin.`,
        groups: founderGroups.map((g: any) => ({ id: g.id, name: g.name })),
      }, 409);
    }

    // 3. Delete the auth user — cascade handles:
    //    - profiles (on delete cascade)
    //    - group_members where user_id = this user (on delete cascade from profiles?
    //      actually it's nullable so no direct cascade — but auth.users delete cascades to profiles)
    //    - groups where created_by = this user (wait, this is a regular FK, not cascade)
    //
    //    Actually, we need to be careful. Let's check the schema:
    //    - profiles.id references auth.users(id) on delete cascade ✅
    //    - groups.created_by references profiles(id) — NO cascade, just references
    //    - group_members.user_id references profiles(id) — nullable, NO cascade
    //
    //    So deleting auth.users cascades to profiles, but profiles → groups has no cascade.
    //    Groups where the user is founder would be orphaned (created_by points to deleted profile).
    //
    //    BUT we already checked above — user cannot delete if they're founder of groups with members.
    //    If user is founder of a group with NO other members (solo group), it's safe to delete.
    //    We should delete those solo groups first, THEN delete the user.

    // 3a. Delete groups where user is the ONLY member (solo founder groups)
    const { data: soloGroups } = await supabase
      .from('groups')
      .select('id')
      .eq('created_by', userId);

    if (soloGroups && soloGroups.length > 0) {
      // Count real members per group
      for (const g of soloGroups) {
        const { data: members } = await supabase
          .from('group_members')
          .select('id, user_id, is_active')
          .eq('group_id', g.id)
          .eq('is_active', true)
          .neq('user_id', userId)
          .not('user_id', 'is', null);

        if (!members || members.length === 0) {
          // Solo group — delete it (cascade handles expenses, etc.)
          await supabase.from('groups').delete().eq('id', g.id);
        }
      }
    }

    // 4. Delete the auth user — cascade deletes profiles
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('[delete-account] Failed to delete user:', deleteError);
      throw deleteError;
    }

    return json({ success: true });
  } catch (err: any) {
    console.error('[delete-account]', err);
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
