-- ============================================================
-- 0002: Invite preview RPC (RLS baypas)
-- Sorun: Katılmak isteyen kişi henüz üye değil → RLS engelliyor
-- Çözüm: SECURITY DEFINER fonksiyon ile RLS baypas
-- ============================================================

-- Davet önizleme: token geçerli mi, hangi grup, kaç üye
create or replace function preview_invite(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_group record;
  v_member_count int;
begin
  -- Token lookup
  select * into v_invite
  from group_invites
  where upper(trim(token)) = upper(trim(p_token));

  if not found then
    return json_build_object('error', 'invalid_token');
  end if;

  -- Expiry check
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    return json_build_object('error', 'expired');
  end if;

  -- Group info
  select * into v_group from groups where id = v_invite.group_id;

  -- Active member count
  select count(*) into v_member_count
  from group_members
  where group_id = v_invite.group_id and is_active = true;

  return json_build_object(
    'token', v_invite.token,
    'group_id', v_invite.group_id,
    'group_name', v_group.name,
    'member_count', v_member_count
  );
end;
$$;

-- Davet okuma policy'si: HERHANGİ bir auth kullanıcı token ile okuyabilsin
drop policy if exists "any auth can read invite for join" on group_invites;
create policy "any auth can read invite for join" on group_invites
  for select using (auth.uid() is not null);
