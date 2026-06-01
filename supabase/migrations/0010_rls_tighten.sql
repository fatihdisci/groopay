-- ============================================================
-- Groopay — Migration 0010: RLS Policy Daraltma (P0-2)
-- ============================================================
-- Değişiklikler:
--  1. expenses: INSERT/UPDATE/DELETE daraltıldı (SELECT geniş kaldı)
--  2. settlements: INSERT/UPDATE/DELETE KAPATILDI (sadece RPC)
--  3. group_members: INSERT/UPDATE/DELETE daraltıldı
--  4. groups: UPDATE founder-only yapıldı
--  5. activity_log: UPDATE/DELETE kapatıldı
--
-- PRENSİP: SELECT geniş kalır (is_member_of), yazma daraltılır.
-- RPC'ler SECURITY DEFINER olduğu için RLS'i bypass eder — etkilenmez.
-- ============================================================
-- Supabase SQL Editor'e yapıştır, Run et.
-- ============================================================

-- ================================================================
-- PART 0: Yardımcı fonksiyon — is_founder_of
-- ================================================================
-- is_member_of zaten var (0001). Founder kontrolü için ek helper.

create or replace function is_founder_of(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = gid
      and user_id = auth.uid()
      and role = 'founder'
      and is_active = true
  );
$$;

-- ================================================================
-- PART 1: EXPENSES — daralt
-- ================================================================

-- 1a. Eski "for all" politikasını kaldır
drop policy if exists "expenses by membership" on expenses;

-- 1b. SELECT: geniş — tüm grup üyeleri tüm masrafları görebilir
drop policy if exists "expenses select by membership" on expenses;
create policy "expenses select by membership" on expenses
  for select using (is_member_of(group_id));

-- 1c. INSERT: grup üyesi olmak yeterli (defense-in-depth;
--     asıl masraf ekleme add_expense_with_splits RPC üzerinden)
drop policy if exists "expenses insert by membership" on expenses;
create policy "expenses insert by membership" on expenses
  for insert with check (is_member_of(group_id));

-- 1d. UPDATE: sadece masraf sahibi VEYA grup founder'ı
--     "masraf sahibi" = expenses.created_by member'ının user_id'si auth.uid()
drop policy if exists "expenses update by owner or founder" on expenses;
create policy "expenses update by owner or founder" on expenses
  for update using (
    is_member_of(group_id)
    and (
      -- Expense sahibi: created_by member'ı bu kullanıcıya ait
      auth.uid() = (select user_id from group_members where id = expenses.created_by)
      or
      -- Grup founder'ı her masrafı güncelleyebilir
      is_founder_of(group_id)
    )
  );

-- 1e. DELETE: sadece masraf sahibi VEYA grup founder'ı
--     (şu an soft-delete UPDATE kullanılıyor, bu policy ileriye dönük)
drop policy if exists "expenses delete by owner or founder" on expenses;
create policy "expenses delete by owner or founder" on expenses
  for delete using (
    is_member_of(group_id)
    and (
      auth.uid() = (select user_id from group_members where id = expenses.created_by)
      or is_founder_of(group_id)
    )
  );

-- ================================================================
-- PART 2: EXPENSE_SPLITS — şimdilik koru, P0-4'te tamamen kaldırılacak
-- ================================================================
-- expense_splits'e doğrudan yazma SADECE updateExpenseWithSplits'ten
-- geliyor. P0-4'te bu RPC'ye çevrilecek. Şimdilik mevcut policy'yi
-- daraltılmış halde bırak (expense üzerinden is_member_of).

drop policy if exists "splits by membership" on expense_splits;

-- SELECT: expense'in grubuna üyelik yeterli
create policy "splits select by expense membership" on expense_splits
  for select using (
    is_member_of((select group_id from expenses where id = expense_id))
  );

-- INSERT/DELETE: aynı kontrol (defense-in-depth, P0-4'te RPC'ye geçecek)
create policy "splits insert by expense membership" on expense_splits
  for insert with check (
    is_member_of((select group_id from expenses where id = expense_id))
  );

create policy "splits delete by expense membership" on expense_splits
  for delete using (
    is_member_of((select group_id from expenses where id = expense_id))
  );

-- ================================================================
-- PART 3: SETTLEMENTS — doğrudan yazmaya KAPAT
-- ================================================================
-- Tüm settlement yazmaları RPC üzerinden (add/confirm/reject).
-- RPC'ler SECURITY DEFINER → RLS bypass → etkilenmez.

drop policy if exists "settlements by membership" on settlements;

-- SELECT: geniş — grup üyeleri tüm settlement'ları görebilir
create policy "settlements select by membership" on settlements
  for select using (is_member_of(group_id));

-- INSERT/UPDATE/DELETE: POLİTİKA YOK → doğrudan erişim ENGELLENDİ
-- Sadece SECURITY DEFINER RPC'ler yazabilir.

-- ================================================================
-- PART 4: GROUP_MEMBERS — daralt
-- ================================================================

drop policy if exists "members read same group" on group_members;
drop policy if exists "members manage same group" on group_members;

-- 4a. SELECT: geniş — tüm grup üyelerini görebilir
create policy "members select by membership" on group_members
  for select using (is_member_of(group_id));

-- 4b. INSERT: iki senaryo
--     A) Grup kurucusu ilk founder üyeliğini ekler (henüz member yok)
--     B) Mevcut üye hayalet ekler
create policy "members insert by creator or member" on group_members
  for insert with check (
    -- Scenario A: Grup kurucusu (groups.created_by)
    exists (select 1 from groups g where g.id = group_id and g.created_by = auth.uid())
    or
    -- Scenario B: Mevcut aktif üye
    is_member_of(group_id)
  );

-- 4c. UPDATE: kendi üyeliğini VEYA founder herkesi güncelleyebilir
create policy "members update self or founder" on group_members
  for update using (
    -- Kendi member satırı (user_id üzerinden)
    (user_id = auth.uid())
    or
    -- Founder bu gruptaki herkesi güncelleyebilir
    is_founder_of(group_id)
  ) with check (
    (user_id = auth.uid())
    or
    is_founder_of(group_id)
  );

-- 4d. DELETE: doğrudan silme YOK (remove_member RPC'si deactivate yapar)
--     Policy eklenmez → doğrudan DELETE engellenir.

-- ================================================================
-- PART 5: GROUPS — UPDATE'i founder-only yap
-- ================================================================

-- SELECT ve INSERT zaten doğru (0001'de):
--   "member can read group" → is_member_of(id)  ✅
--   "any auth can create group" → created_by = auth.uid() ✅

-- UPDATE: şu an "member can update group" → is_member_of(id)
-- Bu ÇOK GENİŞ — herhangi bir üye grubu güncelleyebilir.
-- Daralt: sadece founder.

drop policy if exists "member can update group" on groups;
create policy "founder can update group" on groups
  for update using (created_by = auth.uid());

-- ================================================================
-- PART 6: ACTIVITY_LOG — UPDATE/DELETE kapat
-- ================================================================

drop policy if exists "activity by membership" on activity_log;

-- SELECT: geniş — tüm grup aktivitesini görebilir
create policy "activity select by membership" on activity_log
  for select using (is_member_of(group_id));

-- INSERT: grup üyesi ekleyebilir (birçok fonksiyon activity log'lar)
create policy "activity insert by membership" on activity_log
  for insert with check (is_member_of(group_id));

-- UPDATE/DELETE: POLİTİKA YOK → engellendi (aktivite logu değiştirilemez)

-- ================================================================
-- PART 7: GROUP_INVITES — mevcut policy'ler yeterli, dokunma
-- ================================================================
-- "invites read by member" → SELECT: is_member_of ✅
-- "invites create by member" → INSERT: is_member_of ✅
-- "any auth can read invite for join" → SELECT: auth.uid() is not null ✅
-- (0002'de eklendi)

-- ================================================================
-- PART 8: IBAN_REQUESTS — mevcut policy yeterli, dokunma
-- ================================================================
-- "iban_requests by membership" → for all: is_member_of ✅
-- (0006'da eklendi)

-- ================================================================
-- Bitti. ✅
-- Test: Normal kullanıcı akışı (masraf ekle/sil, settlement işaretle/
-- onayla, ghost ekle, gruptan ayrıl) çalışmalı.
-- Yetkisiz: doğrudan expense delete, settlement insert, member delete
-- çağrıları REDDEDİLMELİ.
-- ================================================================
