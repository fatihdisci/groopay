-- ============================================================
-- Groopay — Migration 0004: Yeni Para Birimi Modeli
-- ============================================================
-- Değişiklikler:
--  1. expenses.fx_rate_to_base DROP COLUMN
--  2. expenses.amount_in_base DROP COLUMN
--  3. expense_splits.share_amount_base DROP COLUMN
--  4. add_expense_with_splits RPC (atomik masraf + split ekleme)
-- ============================================================
-- Supabase SQL Editor'e yapıştır, Run et.
-- ============================================================

-- ================================================================
-- PART 1: Eski FX sütunlarını kaldır
-- ================================================================

-- Expenses: fx_rate_to_base ve amount_in_base kaldırılıyor
alter table expenses
  drop column if exists fx_rate_to_base,
  drop column if exists amount_in_base;

-- Expense splits: share_amount_base kaldırılıyor
alter table expense_splits
  drop column if exists share_amount_base;

-- ================================================================
-- PART 2: add_expense_with_splits RPC (transaction)
-- ================================================================
-- Neden RPC: Masraf + split'lerin ATOMİK (tek transaction) eklenmesi.
-- Eğer split insert'i başarısız olursa masraf da eklenmez (rollback).
-- Para birimi: ORİJİNAL para biriminde saklanır, çevrim YAPILMAZ.

create or replace function add_expense_with_splits(
  p_group_id uuid,
  p_description text,
  p_note text,
  p_amount numeric(14,2),
  p_currency text,
  p_category text,
  p_split_type split_type,
  p_paid_by uuid,
  p_created_by uuid,
  p_expense_date date,
  p_splits jsonb   -- [{member_id, share_amount}, ...]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense_id uuid;
  v_split record;
begin
  -- 1. Masrafı ekle (orijinal para biriminde, base sütunu YOK)
  insert into expenses (
    group_id, description, note, amount, currency,
    category, split_type, paid_by, created_by, expense_date
  ) values (
    p_group_id, p_description, p_note, p_amount, p_currency,
    p_category, p_split_type, p_paid_by, p_created_by, p_expense_date
  )
  returning id into v_expense_id;

  -- 2. Split'leri ekle (orijinal para biriminde)
  for v_split in
    select * from jsonb_to_recordset(p_splits) as x(
      member_id uuid,
      share_amount numeric(14,2)
    )
  loop
    insert into expense_splits (expense_id, member_id, share_amount)
    values (v_expense_id, v_split.member_id, v_split.share_amount);
  end loop;

  -- 3. Aktivite logu
  insert into activity_log (
    group_id, actor_member_id, action_type,
    target_type, target_id, metadata
  ) values (
    p_group_id, p_created_by, 'expense_added',
    'expense', v_expense_id,
    jsonb_build_object(
      'description', p_description,
      'amount', p_amount,
      'currency', p_currency,
      'category', p_category,
      'split_type', p_split_type
    )
  );

  return v_expense_id;
end;
$$;
