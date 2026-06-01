-- ============================================================
-- Groopay — Migration 0009: RPC Yetki Kontrolleri (P0-1)
-- ============================================================
-- Değişiklikler:
--  1. add_expense_with_splits: auth.uid() + üyelik + bölüşüm doğrulama
--  2. add_settlement: auth.uid() + üyelik + borçlu/alacaklı kontrolü
--  3. confirm_settlement: auth.uid() + sadece alacaklı onaylar
--  4. reject_settlement: auth.uid() + sadece alacaklı reddeder
--
-- ⚠️ Mevcut imzalar KORUNDU — client kodu değişmez.
-- ⚠️ Normal kullanıcı akışı etkilenmez, sadece yetkisiz çağrılar reddedilir.
-- ============================================================
-- Supabase SQL Editor'e yapıştır, Run et.
-- ============================================================

-- ================================================================
-- PART 1: add_expense_with_splits — yetki + doğrulama
-- ================================================================

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
  v_actor record;
  v_payer record;
  v_split record;
  v_expense_id uuid;
  v_split_sum numeric(14,2);
begin
  -- ── Yetki 1: p_amount > 0 ──
  if p_amount <= 0 then
    raise exception 'Tutar sıfırdan büyük olmalıdır';
  end if;

  -- ── Yetki 2: p_created_by bu kullanıcıya ait aktif bir üyelik mi? ──
  select * into v_actor
  from group_members
  where id = p_created_by
    and user_id = auth.uid()
    and group_id = p_group_id
    and is_active = true;

  if not found then
    raise exception 'Bu işlemi yapmaya yetkiniz yok';
  end if;

  -- ── Yetki 3: p_paid_by aynı grupta aktif üye mi? ──
  select * into v_payer
  from group_members
  where id = p_paid_by
    and group_id = p_group_id
    and is_active = true;

  if not found then
    raise exception 'Ödeyen kişi bu grupta bulunamadı';
  end if;

  -- ── Yetki 4: Bölüşüm toplamı == tutar? (1 kuruş tolerans) ──
  select coalesce(sum(x.share_amount), 0) into v_split_sum
  from jsonb_to_recordset(p_splits) as x(
    member_id uuid,
    share_amount numeric(14,2)
  );

  if abs(v_split_sum - p_amount) > 0.01 then
    raise exception 'Bölüşüm toplamı masraf tutarıyla eşleşmiyor (toplam: %, beklenen: %)',
      v_split_sum, p_amount;
  end if;

  -- ── Yetki 5: Her split üyesi aynı grupta aktif üye mi? ──
  for v_split in
    select * from jsonb_to_recordset(p_splits) as x(
      member_id uuid,
      share_amount numeric(14,2)
    )
  loop
    perform 1 from group_members
    where id = v_split.member_id
      and group_id = p_group_id
      and is_active = true;

    if not found then
      raise exception 'Bölüşümdeki üye bu grupta bulunamadı';
    end if;
  end loop;

  -- ── 1. Masrafı ekle ──
  insert into expenses (
    group_id, description, note, amount, currency,
    category, split_type, paid_by, created_by, expense_date
  ) values (
    p_group_id, p_description, p_note, p_amount, p_currency,
    p_category, p_split_type, p_paid_by, p_created_by, p_expense_date
  )
  returning id into v_expense_id;

  -- ── 2. Split'leri ekle ──
  for v_split in
    select * from jsonb_to_recordset(p_splits) as x(
      member_id uuid,
      share_amount numeric(14,2)
    )
  loop
    insert into expense_splits (expense_id, member_id, share_amount)
    values (v_expense_id, v_split.member_id, v_split.share_amount);
  end loop;

  -- ── 3. Aktivite logu ──
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


-- ================================================================
-- PART 2: add_settlement — yetki + borçlu/alacaklı kontrolü
-- ================================================================

create or replace function add_settlement(
  p_group_id uuid,
  p_from_member uuid,       -- debtor (pays)
  p_to_member uuid,         -- creditor (receives)
  p_amount numeric(14,2),
  p_currency text,
  p_marked_by uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_id uuid;
begin
  -- ── Yetki 1: p_marked_by bu kullanıcıya ait aktif üyelik mi? ──
  select * into v_actor
  from group_members
  where id = p_marked_by
    and user_id = auth.uid()
    and is_active = true;

  if not found then
    raise exception 'Bu işlemi yapmaya yetkiniz yok';
  end if;

  -- ── Yetki 2: p_from_member aynı grupta aktif üye mi? ──
  perform 1 from group_members
  where id = p_from_member
    and group_id = p_group_id
    and is_active = true;

  if not found then
    raise exception 'Borçlu bu grupta bulunamadı';
  end if;

  -- ── Yetki 3: p_to_member aynı grupta aktif üye mi? ──
  perform 1 from group_members
  where id = p_to_member
    and group_id = p_group_id
    and is_active = true;

  if not found then
    raise exception 'Alacaklı bu grupta bulunamadı';
  end if;

  -- ── Yetki 4: p_marked_by, borçlu VEYA alacaklı olmalı ──
  if p_marked_by <> p_from_member and p_marked_by <> p_to_member then
    raise exception 'Sadece borçlu veya alacaklı ödeme işaretleyebilir';
  end if;

  -- ── Settlement'ı ekle ──
  insert into settlements (
    group_id, from_member, to_member, amount, currency,
    status, marked_by, note
  ) values (
    p_group_id, p_from_member, p_to_member, p_amount, p_currency,
    'pending', p_marked_by, p_note
  )
  returning id into v_id;

  -- Activity log
  insert into activity_log (
    group_id, actor_member_id, action_type,
    target_type, target_id, metadata
  ) values (
    p_group_id, p_marked_by, 'settlement_marked',
    'settlement', v_id,
    jsonb_build_object(
      'from_member', p_from_member,
      'to_member', p_to_member,
      'amount', p_amount,
      'currency', p_currency
    )
  );

  return v_id;
end;
$$;


-- ================================================================
-- PART 3: confirm_settlement — auth.uid() + sadece alacaklı
-- ================================================================

create or replace function confirm_settlement(
  p_settlement_id uuid,
  p_confirmed_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement record;
  v_actor record;
  v_group_id uuid;
begin
  -- ── Yetki 1: Settlement var mı? ──
  select * into v_settlement
  from settlements
  where id = p_settlement_id;

  if not found then
    raise exception 'Ödeme kaydı bulunamadı';
  end if;

  -- ── Yetki 2: Settlement hâlâ pending mi? ──
  if v_settlement.status <> 'pending' then
    raise exception 'Bu ödeme zaten işleme alınmış';
  end if;

  -- ── Yetki 3: p_confirmed_by bu kullanıcıya ait aktif üyelik mi? ──
  select * into v_actor
  from group_members
  where id = p_confirmed_by
    and user_id = auth.uid()
    and is_active = true;

  if not found then
    raise exception 'Bu işlemi yapmaya yetkiniz yok';
  end if;

  -- ── Yetki 4: SADECE alacaklı (to_member) onaylayabilir ──
  if v_settlement.to_member <> p_confirmed_by then
    raise exception 'Sadece alacaklı onaylayabilir';
  end if;

  -- ── Onayla ──
  update settlements
  set status = 'confirmed',
      confirmed_by = p_confirmed_by,
      confirmed_at = now()
  where id = p_settlement_id
  returning group_id into v_group_id;

  -- Activity log
  insert into activity_log (
    group_id, actor_member_id, action_type,
    target_type, target_id, metadata
  ) values (
    v_group_id, p_confirmed_by, 'settlement_confirmed',
    'settlement', p_settlement_id,
    jsonb_build_object('settlement_id', p_settlement_id)
  );
end;
$$;


-- ================================================================
-- PART 4: reject_settlement — auth.uid() + sadece alacaklı
-- ================================================================

create or replace function reject_settlement(
  p_settlement_id uuid,
  p_confirmed_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement record;
  v_actor record;
  v_group_id uuid;
begin
  -- ── Yetki 1: Settlement var mı? ──
  select * into v_settlement
  from settlements
  where id = p_settlement_id;

  if not found then
    raise exception 'Ödeme kaydı bulunamadı';
  end if;

  -- ── Yetki 2: Settlement hâlâ pending mi? ──
  if v_settlement.status <> 'pending' then
    raise exception 'Bu ödeme zaten işleme alınmış';
  end if;

  -- ── Yetki 3: p_confirmed_by bu kullanıcıya ait aktif üyelik mi? ──
  select * into v_actor
  from group_members
  where id = p_confirmed_by
    and user_id = auth.uid()
    and is_active = true;

  if not found then
    raise exception 'Bu işlemi yapmaya yetkiniz yok';
  end if;

  -- ── Yetki 4: SADECE alacaklı (to_member) reddedebilir ──
  if v_settlement.to_member <> p_confirmed_by then
    raise exception 'Sadece alacaklı reddedebilir';
  end if;

  -- ── Reddet ──
  update settlements
  set status = 'rejected',
      confirmed_by = p_confirmed_by,
      confirmed_at = now()
  where id = p_settlement_id
  returning group_id into v_group_id;

  -- Activity log
  insert into activity_log (
    group_id, actor_member_id, action_type,
    target_type, target_id, metadata
  ) values (
    v_group_id, p_confirmed_by, 'settlement_rejected',
    'settlement', p_settlement_id,
    jsonb_build_object('settlement_id', p_settlement_id)
  );
end;
$$;

-- ================================================================
-- Bitti. ✅
-- Test: Yetkisiz çağrılar reddedilmeli, normal akış çalışmalı.
-- ================================================================
