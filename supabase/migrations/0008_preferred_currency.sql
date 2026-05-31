-- ============================================================
-- Groopay — Migration 0008: Varsayılan Para Birimi
-- ============================================================
-- Değişiklikler:
--   1. profiles: preferred_currency ekle (nullable text)
--      NULL = otomatik (dashboard dominant para birimini seçer)
-- ============================================================
-- Supabase SQL Editor'e yapıştır, Run et.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_currency text;
COMMENT ON COLUMN profiles.preferred_currency IS 'User default display currency for dashboard. NULL = auto-detect dominant currency from expenses.';
