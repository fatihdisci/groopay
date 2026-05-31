-- ============================================================
-- Groopay — Initial Schema Migration
-- Faz 2: Veri modeli + RLS + Profiles trigger
-- ============================================================
-- Idempotent: tekrar çalıştırılırsa patlamaz.
-- Supabase SQL Editor'e yapıştır, Run et.
-- ============================================================

-- ============ EXTENSIONS ============
create extension if not exists "pgcrypto";

-- ============ ENUMS ============
do $$ begin
  create type member_role as enum ('founder', 'member');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type settlement_status as enum ('pending', 'confirmed', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type split_type as enum ('equal', 'custom', 'subset');
exception when duplicate_object then null;
end $$;

-- ============ TABLES ============

-- PROFILES (auth.users uzantısı)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Kullanıcı',
  avatar_color text not null default '#6C5CE7',
  locale text not null default 'tr',
  expo_push_token text,
  user_pro boolean not null default false,
  user_pro_purchased_at timestamptz,
  created_at timestamptz not null default now()
);

-- GROUPS
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  base_currency text not null default 'TRY',
  created_by uuid not null references profiles(id),
  is_pro boolean not null default false,
  pro_purchased_by uuid references profiles(id),
  pro_purchased_at timestamptz,
  is_demo boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- GROUP MEMBERS (hibrit: hayalet + gerçek)
create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid references profiles(id),
  display_name text not null,
  role member_role not null default 'member',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (group_id, user_id)
);

-- GROUP INVITES (linkle katılım)
create table if not exists group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references profiles(id),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- EXPENSES
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  description text not null,
  note text,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null,
  fx_rate_to_base numeric(18,8) not null,
  amount_in_base numeric(14,2) not null,
  category text not null default 'other',
  split_type split_type not null,
  paid_by uuid not null references group_members(id),
  expense_date date not null default current_date,
  created_by uuid not null references group_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- EXPENSE SPLITS (kim ne kadar pay aldı)
create table if not exists expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  member_id uuid not null references group_members(id),
  share_amount numeric(14,2) not null check (share_amount >= 0),
  share_amount_base numeric(14,2) not null,
  unique (expense_id, member_id)
);

-- SETTLEMENTS (çift taraflı "ödendi")
create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  from_member uuid not null references group_members(id),
  to_member uuid not null references group_members(id),
  amount_base numeric(14,2) not null check (amount_base > 0),
  status settlement_status not null default 'pending',
  marked_by uuid not null references group_members(id),
  confirmed_by uuid references group_members(id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  note text
);

-- ACTIVITY LOG (aktivite akışı)
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  actor_member_id uuid references group_members(id),
  action_type text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============ INDEXES ============
create index if not exists idx_members_group on group_members(group_id);
create index if not exists idx_members_user on group_members(user_id);
create index if not exists idx_expenses_group on expenses(group_id) where deleted_at is null;
create index if not exists idx_splits_expense on expense_splits(expense_id);
create index if not exists idx_splits_member on expense_splits(member_id);
create index if not exists idx_settlements_group on settlements(group_id);
create index if not exists idx_activity_group on activity_log(group_id);
create index if not exists idx_groups_created_by on groups(created_by);
create index if not exists idx_profiles_locale on profiles(locale);

-- ============ RLS HELPER: is_member_of ============
-- SECURITY DEFINER => RLS baypas eder, recursion'ı önler.
create or replace function is_member_of(gid uuid)
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
      and is_active = true
  );
$$;

-- ============ RLS: ENABLE ============
alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_invites enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;
alter table settlements enable row level security;
alter table activity_log enable row level security;

-- ============ RLS: POLICIES ============

-- PROFILES
drop policy if exists "own profile read" on profiles;
create policy "own profile read" on profiles
  for select using (id = auth.uid());

drop policy if exists "own profile update" on profiles;
create policy "own profile update" on profiles
  for update using (id = auth.uid());

drop policy if exists "own profile insert" on profiles;
create policy "own profile insert" on profiles
  for insert with check (id = auth.uid());

-- GROUPS
drop policy if exists "member can read group" on groups;
create policy "member can read group" on groups
  for select using (is_member_of(id));

drop policy if exists "any auth can create group" on groups;
create policy "any auth can create group" on groups
  for insert with check (created_by = auth.uid());

drop policy if exists "member can update group" on groups;
create policy "member can update group" on groups
  for update using (is_member_of(id));

-- GROUP_MEMBERS
drop policy if exists "members read same group" on group_members;
create policy "members read same group" on group_members
  for select using (is_member_of(group_id));

drop policy if exists "members manage same group" on group_members;
create policy "members manage same group" on group_members
  for all using (is_member_of(group_id)) with check (is_member_of(group_id));

-- GROUP_INVITES
drop policy if exists "invites read by member" on group_invites;
create policy "invites read by member" on group_invites
  for select using (is_member_of(group_id));

drop policy if exists "invites create by member" on group_invites;
create policy "invites create by member" on group_invites
  for insert with check (is_member_of(group_id));

-- EXPENSES
drop policy if exists "expenses by membership" on expenses;
create policy "expenses by membership" on expenses
  for all using (is_member_of(group_id)) with check (is_member_of(group_id));

-- EXPENSE SPLITS
drop policy if exists "splits by membership" on expense_splits;
create policy "splits by membership" on expense_splits
  for all using (
    is_member_of((select group_id from expenses where id = expense_id))
  ) with check (
    is_member_of((select group_id from expenses where id = expense_id))
  );

-- SETTLEMENTS
drop policy if exists "settlements by membership" on settlements;
create policy "settlements by membership" on settlements
  for all using (is_member_of(group_id)) with check (is_member_of(group_id));

-- ACTIVITY LOG
drop policy if exists "activity by membership" on activity_log;
create policy "activity by membership" on activity_log
  for select using (is_member_of(group_id));

-- ============ TRIGGER: handle_new_user ============
-- Yeni auth kullanıcısı oluşunca otomatik profiles satırı açar.
create or replace function handle_new_user()
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
begin
  random_color := colors[floor(random() * array_length(colors, 1) + 1)::int];
  insert into profiles (id, display_name, avatar_color, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Kullanıcı'),
    coalesce(new.raw_user_meta_data->>'avatar_color', random_color),
    coalesce(new.raw_user_meta_data->>'locale', 'tr')
  );
  return new;
end;
$$;

-- Trigger'ı sadece yoksa oluştur
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- Bitti. ✅ Run sonrası: tüm tablolar + RLS + trigger hazır.
-- ============================================================
