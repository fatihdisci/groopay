-- ============================================================
-- 0003: Ghost preview RPC (RLS baypas)
-- Katılmak isteyen kişi henüz üye değil → RLS ghost'ları gizliyor
-- Çözüm: SECURITY DEFINER fonksiyon
-- ============================================================

create or replace function preview_ghosts(p_token text)
returns setof group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id
  from group_invites
  where upper(trim(token)) = upper(trim(p_token));

  if not found then
    return;
  end if;

  return query
  select * from group_members
  where group_id = v_group_id
    and user_id is null
    and is_active = true;
end;
$$;
