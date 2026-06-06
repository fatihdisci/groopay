-- ============================================================
-- Groopay — Migration 0015: Profil Trigger'ını Garantile
-- ============================================================
-- Sorun: OAuth ile gelen yeni kullanıcılar için profiles satırı
-- oluşturulamıyor. handle_new_user trigger'ı 0001'de tanımlandı
-- ama deploy edilmemiş veya eksik kalmış olabilir.
--
-- Bu migration idempotent: CREATE OR REPLACE + DROP IF EXISTS.
-- SEES DEFINER → RLS bypass → server-side güvenli insert.
-- ============================================================
-- Supabase SQL Editor → Run
-- ============================================================

-- Profiles trigger function (improved)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  random_color text;
  colors text[] := array[
    '#6C5CE7','#00B894','#E17055','#0984E3',
    '#FDCB6E','#E84393','#00CEC9','#D63031'
  ];
  v_display_name text;
begin
  random_color := colors[floor(random() * array_length(colors, 1) + 1)::int];

  -- Apple Sign-In: full_name comes in raw_user_meta_data->>'name'
  -- Google Sign-In: full_name in raw_user_meta_data->>'full_name'
  v_display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    'Kullanıcı'
  );

  insert into public.profiles (id, display_name, avatar_color, locale)
  values (
    new.id,
    v_display_name,
    coalesce(new.raw_user_meta_data->>'avatar_color', random_color),
    coalesce(new.raw_user_meta_data->>'locale', 'tr')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Drop + recreate trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
