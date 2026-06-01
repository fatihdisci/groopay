-- ============================================================
-- Groopay — Migration 0011: Atomik update_expense + delete_expense RPC (P0-4)
-- ============================================================
-- Değişiklikler:
--  1. update_expense_with_splits RPC — tek transaction (SECURITY DEFINER)
--  2. delete_expense RPC — tek transaction (SECURITY DEFINER)
--
-- Avantaj:
--  - Atomik: expense + splits + activity aynı anda ya olur ya hiçbiri
--  - Yetki: auth.uid() + sahip/founder kontrolü server-side
--  - RLS: SECURITY DEFINER → direk tablo yazımına gerek kalmaz
-- ============================================================
-- Supabase SQL Editor'e yapıştır, Run et.
-- ============================================================

-- ================================================================
-- PART 1: update_expense_with_splits RPC
-- ================================================================
-- NOT: is_founder_of(gid) migration 0010'da tanımlandı.

create or replace function update_expense_with_splits(
  p_expense_id uuid,
  p_description text,
  p_note text,
  p_amount numeric(14,2),
  p_currency text,
  p_category text,
  p_split_type split_type,
  p_paid_by uuid,
  p_actor_member_id uuid,
  p_expense_date date,
  p_splits jsonb   -- [{member_id, share_amount}, ...]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense record;
  v_actor record;
  v_payer record;
  v_split record;
  v_split_sum numeric(14,2);
begin
  -- ── 1. Masraf mevcut mu? ──
  select * into v_expense
  from expenses
  where id = p_expense_id
    and deleted_at is null;

  if not found then
    raise exception 'Masraf bulunamadı';
  end if;

  -- ── 2. p_amount > 0 ──
  if p_amount <= 0 then
    raise exception 'Tutar sıfırdan büyük olmalıdır';
  end if;

  -- ── 3. p_actor_member_id bu kullanıcıya ait aktif üyelik mi? ──
  select * into v_actor
  from group_members
  where id = p_actor_member_id
    and user_id = auth.uid()
    and group_id = v_expense.group_id
    and is_active = true;

  if not found then
    raise exception 'Bu işlemi yapmaya yetkiniz yok';
  end if;

  -- ── 4. YETKİ: masraf sahibi VEYA grup founder'ı mı? ──
  if auth.uid() <> (select user_id from group_members where id = v_expense.created_by)
     and not is_founder_of(v_expense.group_id) then
    raise exception 'Bu masrafı düzenleme yetkiniz yok';
  end if;

  -- ── 5. p_paid_by aynı grupta aktif üye mi? ──
  select * into v_payer
  from group_members
  where id = p_paid_by
    and group_id = v_expense.group_id
    and is_active = true;

  if not found then
    raise exception 'Ödeyen kişi bu grupta bulunamadı';
  end if;

  -- ── 6. Bölüşüm toplamı == tutar? (1 kuruş tolerans) ──
  select coalesce(sum(x.share_amount), 0) into v_split_sum
  from jsonb_to_recordset(p_splits) as x(
    member_id uuid,
    share_amount numeric(14,2)
  );

  if abs(v_split_sum - p_amount) > 0.01 then
    raise exception 'Bölüşüm toplamı masraf tutarıyla eşleşmiyor (toplam: %, beklenen: %)',
      v_split_sum, p_amount;
  end if;

  -- ── 7. Her split üyesi aynı grupta aktif mi? ──
  for v_split in
    select * from jsonb_to_recordset(p_splits) as x(
      member_id uuid,
      share_amount numeric(14,2)
    )
  loop
    perform 1 from group_members
    where id = v_split.member_id
      and group_id = v_expense.group_id
      and is_active = true;

    if not found then
      raise exception 'Bölüşümdeki üye bu grupta bulunamadı';
    end if;
  end loop;

  -- ── 8. Güncelle (tek transaction — her şey atomik) ──

  -- 8a. Expense row'u güncelle
  update expenses
  set description = p_description,
      note = p_note,
      amount = p_amount,
      currency = p_currency,
      category = p_category,
      split_type = p_split_type,
      paid_by = p_paid_by,
      expense_date = p_expense_date,
      updated_at = now()
  where id = p_expense_id;

  -- 8b. Eski split'leri sil
  delete from expense_splits
  where expense_id = p_expense_id;

  -- 8c. Yeni split'leri ekle
  for v_split in
    select * from jsonb_to_recordset(p_splits) as x(
      member_id uuid,
      share_amount numeric(14,2)
    )
  loop
    insert into expense_splits (expense_id, member_id, share_amount)
    values (p_expense_id, v_split.member_id, v_split.share_amount);
  end loop;

  -- 8d. Aktivite logu
  insert into activity_log (
    group_id, actor_member_id, action_type,
    target_type, target_id, metadata
  ) values (
    v_expense.group_id, p_actor_member_id, 'expense_updated',
    'expense', p_expense_id,
    jsonb_build_object(
      'description', p_description,
      'amount', p_amount,
      'currency', p_currency,
      'category', p_category,
      'split_type', p_split_type
    )
  );
end;
$$;


-- ================================================================
-- PART 2: delete_expense RPC (soft delete)
-- ================================================================

create or replace function delete_expense(
  p_expense_id uuid,
  p_actor_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense record;
  v_actor record;
begin
  -- ── 1. Masraf mevcut mu? ──
  select * into v_expense
  from expenses
  where id = p_expense_id
    and deleted_at is null;

  if not found then
    raise exception 'Masraf bulunamadı veya zaten silinmiş';
  end if;

  -- ── 2. p_actor_member_id bu kullanıcıya ait aktif üyelik mi? ──
  select * into v_actor
  from group_members
  where id = p_actor_member_id
    and user_id = auth.uid()
    and group_id = v_expense.group_id
    and is_active = true;

  if not found then
    raise exception 'Bu işlemi yapmaya yetkiniz yok';
  end if;

  -- ── 3. YETKİ: masraf sahibi VEYA grup founder'ı mı? ──
  if auth.uid() <> (select user_id from group_members where id = v_expense.created_by)
     and not is_founder_of(v_expense.group_id) then
    raise exception 'Bu masrafı silme yetkiniz yok';
  end if;

  -- ── 4. Soft delete + activity log (tek transaction) ──

  update expenses
  set deleted_at = now(),
      updated_at = now()
  where id = p_expense_id;

  insert into activity_log (
    group_id, actor_member_id, action_type,
    target_type, target_id, metadata
  ) values (
    v_expense.group_id, p_actor_member_id, 'expense_deleted',
    'expense', p_expense_id,
    jsonb_build_object(
      'description', v_expense.description,
      'amount', v_expense.amount,
      'currency', v_expense.currency
    )
  );
end;
$$;

-- ================================================================
-- PART 3: RLS daraltma fırsatı (opsiyonel, bu migration ile)
-- ================================================================
-- Artık expense_splits INSERT/DELETE ve expenses UPDATE/DELETE
-- işlemlerinin TÜMÜ RPC üzerinden yapılıyor (SECURITY DEFINER).
-- RLS doğrudan yazma politikalarını kaldırabiliriz.

-- expense_splits: INSERT ve DELETE'i kaldır (artık RPC'ye taşındı)
drop policy if exists "splits insert by expense membership" on expense_splits;
drop policy if exists "splits delete by expense membership" on expense_splits;

-- expenses: UPDATE ve DELETE'i kaldır (artık RPC'ye taşındı)
drop policy if exists "expenses update by owner or founder" on expenses;
drop policy if exists "expenses delete by owner or founder" on expenses;

-- Not: expenses INSERT ve SELECT + expense_splits SELECT korunuyor.
-- expenses INSERT: createDemoGroup için gerekli.
-- expense_splits SELECT: masraf detay görüntüleme için gerekli.

-- ================================================================
-- Bitti. ✅
-- Test: Masraf düzenleme ve silme akışı çalışmalı.
-- Yetkisiz çağrılar REDDEDİLMELİ.
-- ================================================================
