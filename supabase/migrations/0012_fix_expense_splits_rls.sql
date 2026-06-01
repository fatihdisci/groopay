-- ============================================================
-- Groopay — Migration 0012: expense_splits RLS düzeltmesi
-- ============================================================
-- Sorun: 0011'de expense_splits INSERT/DELETE politikaları kaldırıldı.
-- SECURITY DEFINER RPC'ler teoride RLS bypass etmeliydi ama
-- Supabase'de function owner'a bağlı olarak bazen etmiyor.
-- Çözüm: INSERT/DELETE politikalarını geri ekle (is_member_of ile).
-- RPC zaten SECURITY DEFINER, ekstra politika sorun çıkarmaz.
-- ============================================================
-- Supabase SQL Editor'e yapıştır, Run et.
-- ============================================================

-- expense_splits INSERT: expense'in grubuna üyelik yeterli
drop policy if exists "splits insert by expense membership" on expense_splits;
create policy "splits insert by expense membership" on expense_splits
  for insert with check (
    is_member_of((select group_id from expenses where id = expense_id))
  );

-- expense_splits DELETE: aynı kontrol
drop policy if exists "splits delete by expense membership" on expense_splits;
create policy "splits delete by expense membership" on expense_splits
  for delete using (
    is_member_of((select group_id from expenses where id = expense_id))
  );

-- expenses UPDATE: geri ekle (owner veya founder)
-- Bu da 0011'de kaldırılmıştı; RPC yetmezse diye geri koy
drop policy if exists "expenses update by owner or founder" on expenses;
create policy "expenses update by owner or founder" on expenses
  for update using (
    is_member_of(group_id)
    and (
      auth.uid() = (select user_id from group_members where id = expenses.created_by)
      or is_founder_of(group_id)
    )
  );

-- expenses DELETE: geri ekle
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
-- Bitti. ✅
-- expense_splits INSERT/DELETE + expenses UPDATE/DELETE geri geldi.
-- ================================================================
