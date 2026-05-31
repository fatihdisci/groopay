-- ============================================================
-- Groopay — Migration 0006: Settlement Para Birimi + IBAN Requests
-- ============================================================
-- Değişiklikler:
--  1. settlements: amount_base → amount + currency (para birimi bazlı)
--  2. iban_requests: IBAN istek tablosu (IBAN'ın KENDİSİ SAKLANMAZ)
--  3. add_settlement RPC (pending settlement + activity log)
--  4. confirm_settlement RPC (confirmed + activity log)
--  5. reject_settlement RPC (rejected + activity log)
-- ============================================================
-- Supabase SQL Editor'e yapıştır, Run et.
-- ============================================================

-- ================================================================
-- PART 1: settlements tablosunu para birimi bazına güncelle
-- ================================================================

-- amount_base → amount (yeniden adlandır)
alter table settlements
  rename column amount_base to amount;

-- currency sütunu ekle (varsayılan TRY, sonra not null yap)
alter table settlements
  add column if not exists currency text;

-- Mevcut satırlar varsa TRY olarak işaretle
update settlements set currency = 'TRY' where currency is null;

-- currency'yi not null yap
alter table settlements
  alter column currency set not null;

-- ================================================================
-- PART 2: iban_requests tablosu (IBAN SAKLANMAZ)
-- ================================================================

create table if not exists iban_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  from_member uuid not null references group_members(id),   -- debtor requesting
  to_member uuid not null references group_members(id),     -- creditor
  status text not null default 'pending',                   -- pending, fulfilled, expired
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
  -- ⚠️ NO iban column — IBAN is NEVER persisted
);

-- RLS for iban_requests: group members only
alter table iban_requests enable row level security;

drop policy if exists "iban_requests by membership" on iban_requests;
create policy "iban_requests by membership" on iban_requests
  for all using (is_member_of(group_id)) with check (is_member_of(group_id));

-- ================================================================
-- PART 3: Settlement RPC'leri
-- ================================================================

-- 3a. add_settlement: borçlu "ödedim" der → pending oluşur
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
  v_id uuid;
begin
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

-- 3b. confirm_settlement: alacaklı onaylar → confirmed
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
  v_group_id uuid;
begin
  update settlements
  set status = 'confirmed',
      confirmed_by = p_confirmed_by,
      confirmed_at = now()
  where id = p_settlement_id
    and status = 'pending'
  returning group_id into v_group_id;

  if not found then
    raise exception 'Settlement not found or not pending';
  end if;

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

-- 3c. reject_settlement: alacaklı reddeder → rejected
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
  v_group_id uuid;
begin
  update settlements
  set status = 'rejected',
      confirmed_by = p_confirmed_by,
      confirmed_at = now()
  where id = p_settlement_id
    and status = 'pending'
  returning group_id into v_group_id;

  if not found then
    raise exception 'Settlement not found or not pending';
  end if;

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
-- PART 4: Realtime publication'a yeni tabloları ekle
-- ================================================================

alter publication supabase_realtime add table settlements;
alter publication supabase_realtime add table iban_requests;
