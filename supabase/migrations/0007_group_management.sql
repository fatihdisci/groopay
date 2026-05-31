-- ============================================================
-- Groopay — Migration 0007: Grup Yönetimi
-- ============================================================
-- Değişiklikler:
--  1. groups: description, avatar_emoji, avatar_color ekle
--  2. delete_group RPC (kurucu grubu tamamen siler, hard delete)
--  3. remove_member RPC (kurucu herkesi çıkarabilir, üye sadece kendini)
--  4. transfer_ownership RPC (kurucu başkasına devreder)
-- ============================================================
-- Supabase SQL Editor'e yapıştır, Run et.
-- ============================================================

-- ================================================================
-- PART 1: groups tablosuna yeni sütunlar
-- ================================================================

alter table groups
  add column if not exists description text,
  add column if not exists avatar_emoji text,
  add column if not exists avatar_color text not null default '#6C5CE7';

-- ================================================================
-- PART 2: delete_group RPC
-- ================================================================
-- SADECE grup kurucusu çağırabilir. Hard delete — cascade ile
-- tüm expenses, splits, members, settlements, activity silinir.
-- Geri alınamaz!

create or replace function delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
begin
  -- Check group exists and caller is founder
  select created_by into v_created_by
  from groups
  where id = p_group_id;

  if not found then
    raise exception 'Group not found';
  end if;

  if v_created_by <> auth.uid() then
    raise exception 'Only the group founder can delete the group';
  end if;

  -- Hard delete — cascade handles members, expenses, settlements,
  -- activity_log, group_invites, iban_requests, expense_splits
  delete from groups where id = p_group_id;
end;
$$;

-- ================================================================
-- PART 3: remove_member RPC
-- ================================================================
-- Kurucu: herkesi çıkarabilir (kendi hariç)
-- Normal üye: sadece kendini çıkarabilir (gruptan ayrılma)
-- is_active = false yapar, veri korunur.

create or replace function remove_member(
  p_group_id uuid,
  p_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_user_id uuid := auth.uid();
  v_caller_member_id uuid;
  v_caller_role member_role;
  v_target_user_id uuid;
  v_target_role member_role;
begin
  -- Get caller's membership
  select id, role into v_caller_member_id, v_caller_role
  from group_members
  where group_id = p_group_id
    and user_id = v_caller_user_id
    and is_active = true;

  if not found then
    raise exception 'You are not an active member of this group';
  end if;

  -- Get target member info
  select user_id, role into v_target_user_id, v_target_role
  from group_members
  where id = p_member_id
    and group_id = p_group_id;

  if not found then
    raise exception 'Member not found in this group';
  end if;

  -- Founder cannot be removed (use transfer_ownership first)
  if v_target_role = 'founder' then
    raise exception 'Founder cannot be removed. Transfer ownership first.';
  end if;

  -- Permission check
  if v_caller_role = 'founder' then
    -- Founder can remove anyone (except self, which is already blocked above)
    null;
  elsif v_caller_member_id = p_member_id then
    -- Member can remove self (leave group)
    null;
  else
    raise exception 'You can only remove yourself from this group';
  end if;

  -- Deactivate the member
  update group_members
  set is_active = false
  where id = p_member_id
    and group_id = p_group_id;

  -- Activity log
  insert into activity_log (
    group_id, actor_member_id, action_type,
    target_type, target_id, metadata
  ) values (
    p_group_id, v_caller_member_id, 'member_deactivated',
    'member', p_member_id,
    jsonb_build_object('display_name', (
      select display_name from group_members where id = p_member_id
    ))
  );
end;
$$;

-- ================================================================
-- PART 4: transfer_ownership RPC
-- ================================================================
-- Mevcut kurucu, founder'lığı başka bir aktif üyeye devreder.
-- created_by değişir, roller güncellenir.

create or replace function transfer_ownership(
  p_group_id uuid,
  p_new_founder_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_user_id uuid := auth.uid();
  v_caller_member_id uuid;
  v_caller_role member_role;
  v_new_founder_user_id uuid;
  v_new_founder_role member_role;
begin
  -- Get caller's membership
  select id, role into v_caller_member_id, v_caller_role
  from group_members
  where group_id = p_group_id
    and user_id = v_caller_user_id
    and is_active = true;

  if not found then
    raise exception 'You are not an active member of this group';
  end if;

  if v_caller_role <> 'founder' then
    raise exception 'Only the founder can transfer ownership';
  end if;

  -- Get new founder info
  select user_id, role into v_new_founder_user_id, v_new_founder_role
  from group_members
  where id = p_new_founder_member_id
    and group_id = p_group_id
    and is_active = true;

  if not found then
    raise exception 'New founder must be an active member of this group';
  end if;

  if v_caller_member_id = p_new_founder_member_id then
    raise exception 'You cannot transfer ownership to yourself';
  end if;

  -- Update groups.created_by
  update groups
  set created_by = v_new_founder_user_id
  where id = p_group_id;

  -- Update roles
  update group_members
  set role = 'member'
  where id = v_caller_member_id;

  update group_members
  set role = 'founder'
  where id = p_new_founder_member_id;

  -- Activity log
  insert into activity_log (
    group_id, actor_member_id, action_type,
    target_type, target_id, metadata
  ) values (
    p_group_id, v_caller_member_id, 'member_added',
    'member', p_new_founder_member_id,
    jsonb_build_object(
      'action', 'ownership_transferred',
      'from_member', v_caller_member_id,
      'to_member', p_new_founder_member_id
    )
  );
end;
$$;

-- ================================================================
-- Bitti. ✅
-- Test: SELECT delete_group('<id>') — sadece kurucu çalıştırabilir.
-- ================================================================
