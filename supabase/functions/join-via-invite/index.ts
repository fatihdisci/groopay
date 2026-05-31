// ──────────────────────────────────────────
// join-via-invite — Supabase Edge Function
// Faz 3: Davetle gruba katılma + hayalet devralma (claim)
// Service-role ile çalışır → RLS baypas.
// ──────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RequestBody {
  token: string;
  claimGhostMemberId?: string; // hayalet devralma
  displayName?: string;       // "yeni üye" ise verilecek ad
}

Deno.serve(async (req: Request) => {
  // CORS
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

    const body: RequestBody = await req.json();
    const { token, claimGhostMemberId, displayName } = body;

    if (!token) {
      return json({ error: 'missing token' }, 400);
    }

    // Service-role client (RLS baypas)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Verify token
    const { data: invite, error: inviteError } = await supabase
      .from('group_invites')
      .select('id, group_id, token, expires_at')
      .eq('token', token.toUpperCase())
      .single();

    if (inviteError || !invite) {
      return json({ error: 'invalid or expired invite code' }, 404);
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return json({ error: 'invite has expired' }, 410);
    }

    // 2. Get the caller's user from JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );

    if (userError || !user) {
      return json({ error: 'invalid auth token' }, 401);
    }

    // 3. Check if already a member (idempotent)
    const { data: existing } = await supabase
      .from('group_members')
      .select('id, display_name, user_id')
      .eq('group_id', invite.group_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      return json({
        success: true,
        action: 'already_member',
        groupId: invite.group_id,
        memberId: existing.id,
      });
    }

    // 4. Get group info for response
    const { data: group } = await supabase
      .from('groups')
      .select('id, name')
      .eq('id', invite.group_id)
      .single();

    let memberId: string;
    let action: string;

    // 5. Claim ghost OR join as new
    if (claimGhostMemberId) {
      // Claim: update existing ghost row → set user_id
      const { data: ghost, error: ghostError } = await supabase
        .from('group_members')
        .select('id, display_name, user_id')
        .eq('id', claimGhostMemberId)
        .eq('group_id', invite.group_id)
        .single();

      if (ghostError || !ghost) {
        return json({ error: 'ghost member not found' }, 404);
      }

      if (ghost.user_id !== null) {
        return json({ error: 'this member is already claimed' }, 409);
      }

      const finalName = displayName || ghost.display_name;

      const { error: updateError } = await supabase
        .from('group_members')
        .update({ user_id: user.id, display_name: finalName, joined_at: new Date().toISOString() })
        .eq('id', claimGhostMemberId);

      if (updateError) throw updateError;

      memberId = claimGhostMemberId;
      action = 'claim';
    } else {
      // Join as new member
      const { data: newMember, error: insertError } = await supabase
        .from('group_members')
        .insert({
          group_id: invite.group_id,
          user_id: user.id,
          display_name: displayName || user.user_metadata?.display_name || 'Kullanıcı',
          role: 'member',
          joined_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError || !newMember) throw insertError ?? new Error('insert failed');

      memberId = newMember.id;
      action = 'join_new';
    }

    // 6. Log activity
    await supabase.from('activity_log').insert({
      group_id: invite.group_id,
      action_type: action === 'claim' ? 'member_claimed' : 'member_joined',
      actor_member_id: memberId,
      target_type: 'group',
      target_id: invite.group_id,
      metadata: {
        token: token.toUpperCase(),
        claimed_ghost: claimGhostMemberId || null,
      },
    });

    return json({
      success: true,
      action,
      groupId: invite.group_id,
      groupName: group?.name ?? '',
      memberId,
    });
  } catch (err: any) {
    console.error('[join-via-invite]', err);
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
