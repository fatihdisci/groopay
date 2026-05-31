-- ============================================================
-- Groopay — Migration 0005: Realtime Publication
-- ============================================================
-- Supabase Realtime için gerekli tabloları publication'a ekler.
-- RLS zaten aktif olduğu için kullanıcı sadece kendi grubunun
-- değişikliklerini alır.
-- ============================================================
-- Supabase SQL Editor'e yapıştır, Run et.
-- ============================================================

-- Mevcut publication'ı al (Supabase default: supabase_realtime)
-- ve ilgili tabloları ekle

alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table expense_splits;
alter publication supabase_realtime add table group_members;
alter publication supabase_realtime add table activity_log;
