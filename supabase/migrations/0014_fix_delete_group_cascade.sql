-- ============================================================
-- Groopay — Migration 0014: Fix delete_group FK cascade
-- ============================================================
-- Sorun: expense_splits, expenses, settlements, activity_log
--   tablolarında group_members(id)'e FK'lar var ama ON DELETE
--   CASCADE yok. PostgreSQL groups → group_members cascade'i
--   expense_splits/expenses/settlements/activity_log FK'larından
--   ÖNCE çalıştırabiliyor → constraint violation.
--
-- Çözüm: delete_group RPC'sini child tabloları manuel silip
--   sonra grubu silecek şekilde güncelle.
-- ============================================================
-- Supabase SQL Editor'e yapıştır, Run et.
-- ============================================================

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

  -- Delete children in correct order to avoid FK violations:
  -- expense_splits, expenses, settlements, activity_log all
  -- reference group_members(id) without CASCADE.

  -- 1. Delete expense_splits for all expenses in this group
  delete from expense_splits
  where expense_id in (select id from expenses where group_id = p_group_id);

  -- 2. Delete expenses (soft-deleted ones too, for cleanup)
  delete from expenses where group_id = p_group_id;

  -- 3. Delete settlements
  delete from settlements where group_id = p_group_id;

  -- 4. Delete activity_log
  delete from activity_log where group_id = p_group_id;

  -- 5. Delete IBAN requests
  delete from iban_requests where group_id = p_group_id;

  -- 6. Delete group invites
  delete from group_invites where group_id = p_group_id;

  -- 7. Delete group members
  delete from group_members where group_id = p_group_id;

  -- 8. Finally, delete the group itself
  delete from groups where id = p_group_id;
end;
$$;
