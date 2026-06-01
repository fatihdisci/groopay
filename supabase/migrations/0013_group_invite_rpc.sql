-- ============================================================
-- Groopay — Migration 0013: Atomik Grup Oluşturma + Güvenli Davet (P0-5/P0-6/P1-1/P1-9)
-- ============================================================
-- Değişiklikler:
--  1. create_group_with_limit RPC — 5 grup limiti + atomik create
--  2. create_invite RPC — kriptografik token + collision retry + expiry
-- ============================================================
-- Supabase SQL Editor'e yapıştır, Run et.
-- ============================================================

-- ================================================================
-- PART 1: create_group_with_limit RPC
-- ================================================================
-- Atomik grup oluşturma: group + founder member + activity log.
-- Pro değilse en fazla 5 demo-olmayan grup oluşturulabilir.

create or replace function create_group_with_limit(
  p_name text,
  p_base_currency text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_pro boolean;
  v_group_count int;
  v_group_id uuid;
begin
  -- ── 1. auth.uid() kontrolü ──
  if v_user_id is null then
    raise exception 'Oturum açmanız gerekiyor';
  end if;

  -- ── 2. Pro kontrolü ──
  select coalesce(user_pro, false) into v_is_pro
  from profiles
  where id = v_user_id;

  -- ── 3. Grup sayısını kontrol et (demo hariç) ──
  select count(*) into v_group_count
  from groups
  where created_by = v_user_id
    and (is_demo is null or is_demo = false);

  if not v_is_pro and v_group_count >= 5 then
    raise exception 'Ücretsiz planda en fazla 5 grup oluşturabilirsiniz. Daha fazlası için Groopay Pro''ya geçin.';
  end if;

  -- ── 4. Grubu oluştur ──
  insert into groups (name, base_currency, created_by)
  values (p_name, p_base_currency, v_user_id)
  returning id into v_group_id;

  -- ── 5. Founder üyeliğini ekle ──
  insert into group_members (group_id, user_id, display_name, role)
  values (v_group_id, v_user_id, p_display_name, 'founder');

  -- ── 6. Aktivite logu ──
  insert into activity_log (
    group_id, action_type, target_type, target_id, metadata
  ) values (
    v_group_id, 'group_created', 'group', v_group_id, jsonb_build_object('name', p_name)
  );

  return v_group_id;
end;
$$;


-- ================================================================
-- PART 2: create_invite RPC (güvenli token)
-- ================================================================

create or replace function create_invite(
  p_group_id uuid,
  p_expires_in_days int default 7
)
returns text   -- returns the token string
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_user_id uuid := auth.uid();
  v_member_id uuid;
  v_token text;
  v_attempts int := 0;
  v_max_attempts int := 10;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 30 chars, no I/O/0/1
  v_expires_at timestamptz;
begin
  -- ── 1. auth.uid() kontrolü ──
  if v_caller_user_id is null then
    raise exception 'Oturum açmanız gerekiyor';
  end if;

  -- ── 2. Kullanıcı bu grubun aktif üyesi mi? ──
  select id into v_member_id
  from group_members
  where group_id = p_group_id
    and user_id = v_caller_user_id
    and is_active = true;

  if not found then
    raise exception 'Bu grupta aktif üye değilsiniz';
  end if;

  -- ── 3. Expiry hesapla ──
  v_expires_at := now() + (p_expires_in_days || ' days')::interval;

  -- ── 4. Token üret (collision retry ile) ──
  while v_attempts < v_max_attempts loop
    -- 8 karakterli kriptografik token: gen_random_uuid() → hex → hash
    -- → chars içinden seç (her byte mod 30 ile indeksle)
    -- Daha basit: uuid'nin ilk 12 hex karakterini al, her 2 hex'i
    -- 0-255 arası byte'a çevir, mod 30 ile chars'a indeksle
    select string_agg(
      substr(v_chars, (('x' || substr(v_hex, i * 2 + 1, 2))::bit(8)::int % 30) + 1, 1),
      ''
    ) into v_token
    from generate_series(0, 7) as i,
    (select replace(gen_random_uuid()::text, '-', '') as v_hex) as h;

    -- Unique kontrolü
    perform 1 from group_invites
    where token = v_token
      and (expires_at is null or expires_at > now());

    if not found then
      exit; -- token unique, çık
    end if;

    v_attempts := v_attempts + 1;
  end loop;

  if v_attempts >= v_max_attempts then
    raise exception 'Davet kodu oluşturulamadı, lütfen tekrar deneyin';
  end if;

  -- ── 5. Daveti kaydet ──
  insert into group_invites (group_id, token, created_by, expires_at)
  values (p_group_id, v_token, v_caller_user_id, v_expires_at);

  return v_token;
end;
$$;

-- ================================================================
-- Bitti. ✅
-- Test: SELECT create_group_with_limit('Test', 'TRY', 'Ali') → yeni grup id
--       SELECT create_invite('<group_id>') → 8 karakter token
-- ================================================================
