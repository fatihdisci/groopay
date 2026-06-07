-- ============================================================
-- Groopay — Migration 0016: Atomic account data deletion
-- ============================================================
-- Applied in Supabase on 2026-06-07.
--
-- Deletes solo and demo founder groups in FK-safe order, preserves
-- shared-group financial history by anonymizing the departing member,
-- and removes the user's profile. The entire RPC is one transaction.
-- ============================================================

create or replace function public.delete_user_data(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blocking_groups text;
begin
  if auth.uid() is null or auth.uid() <> target_user_id then
    raise exception 'UNAUTHORIZED';
  end if;

  -- Demo groups never block deletion. Normal founder groups with another
  -- active real member must be transferred or deleted first.
  select string_agg(g.name, ', ' order by g.name)
  into v_blocking_groups
  from groups g
  where g.created_by = target_user_id
    and g.is_demo = false
    and exists (
      select 1
      from group_members gm
      where gm.group_id = g.id
        and gm.is_active = true
        and gm.user_id is not null
        and gm.user_id <> target_user_id
    );

  if v_blocking_groups is not null then
    raise exception 'FOUNDER_GROUPS_EXIST:%', v_blocking_groups;
  end if;

  -- Delete all founder-owned groups, including demo groups, in FK-safe order.
  delete from expense_splits
  where expense_id in (
    select e.id
    from expenses e
    join groups g on g.id = e.group_id
    where g.created_by = target_user_id
  );

  delete from expenses
  where group_id in (
    select id from groups where created_by = target_user_id
  );

  delete from settlements
  where group_id in (
    select id from groups where created_by = target_user_id
  );

  delete from activity_log
  where group_id in (
    select id from groups where created_by = target_user_id
  );

  delete from iban_requests
  where group_id in (
    select id from groups where created_by = target_user_id
  );

  delete from group_invites
  where group_id in (
    select id from groups where created_by = target_user_id
  );

  delete from group_members
  where group_id in (
    select id from groups where created_by = target_user_id
  );

  delete from groups
  where created_by = target_user_id;

  -- Remove profile references from surviving shared groups.
  delete from group_invites
  where created_by = target_user_id;

  update groups
  set pro_purchased_by = null
  where pro_purchased_by = target_user_id;

  -- Preserve shared-group expense and settlement history while removing
  -- the reference to the deleted profile.
  update group_members
  set user_id = null,
      is_active = false,
      role = 'member'
  where user_id = target_user_id;

  delete from profiles
  where id = target_user_id;
end;
$$;

revoke all on function public.delete_user_data(uuid) from public;
grant execute on function public.delete_user_data(uuid) to authenticated;
