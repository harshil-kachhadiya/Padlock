-- Padlock initial schema: users, sites, passwords + RLS policies
-- Run this manually in the Supabase SQL editor.

-- 1) users: extends auth.users, holds zero-knowledge key-derivation material only
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  oauth_provider text not null default 'google',
  salt jsonb not null,
  verifier jsonb not null,
  created_at timestamptz not null default now(),
  deleted boolean not null default false
);

alter table public.users enable row level security;

create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

create policy "users_insert_own"
  on public.users for insert
  with check (auth.uid() = id);

create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "users_delete_own"
  on public.users for delete
  using (auth.uid() = id);

-- 2) sites: site metadata (username stored as plaintext, per spec)
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  site_name text not null,
  site_url text not null,
  username text,
  created_at timestamptz not null default now(),
  deleted boolean not null default false
);

alter table public.sites enable row level security;

create policy "sites_select_own"
  on public.sites for select
  using (auth.uid() = user_id);

create policy "sites_insert_own"
  on public.sites for insert
  with check (auth.uid() = user_id);

create policy "sites_update_own"
  on public.sites for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sites_delete_own"
  on public.sites for delete
  using (auth.uid() = user_id);

-- 3) passwords: ciphertext only, never plaintext
create table if not exists public.passwords (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  encrypted_password jsonb not null,
  created_at timestamptz not null default now(),
  deleted boolean not null default false
);

alter table public.passwords enable row level security;

create policy "passwords_select_own"
  on public.passwords for select
  using (auth.uid() = user_id);

create policy "passwords_insert_own"
  on public.passwords for insert
  with check (auth.uid() = user_id);

create policy "passwords_update_own"
  on public.passwords for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "passwords_delete_own"
  on public.passwords for delete
  using (auth.uid() = user_id);

-- Helpful indexes
create index if not exists sites_user_id_idx on public.sites(user_id);
create index if not exists passwords_site_id_idx on public.passwords(site_id);
create index if not exists passwords_user_id_idx on public.passwords(user_id);
