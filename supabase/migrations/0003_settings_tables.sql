-- Settings system: a catalog of available settings + each user's chosen values.
-- Run this manually in the Supabase SQL editor.

-- Table 1: setting_items — the catalog of settings the app supports.
-- Admin-defined (not user-writable). Adding a new setting = one row here.
create table if not exists public.setting_items (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,               -- e.g. 'theme', 'reveal_password_default'
  label text not null,                    -- e.g. "Theme"
  description text,                       -- shown as help text in the UI
  data_type text not null check (data_type in ('boolean', 'string', 'number')),
  default_value jsonb not null,           -- used when a user has no row in user_settings
  created_at timestamptz not null default now()
);

alter table public.setting_items enable row level security;

-- Every signed-in user can read the catalog (needed to render the settings UI
-- and know the defaults) but only the catalog is never user-writable.
create policy "setting_items_select_all"
  on public.setting_items for select
  to authenticated
  using (true);

-- Table 2: user_settings — each user's chosen value for a given setting.
-- Absence of a row means "use setting_items.default_value".
create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  setting_key text not null references public.setting_items(key) on delete cascade,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, setting_key)
);

alter table public.user_settings enable row level security;

create policy "user_settings_select_own"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "user_settings_insert_own"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "user_settings_update_own"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_settings_delete_own"
  on public.user_settings for delete
  using (auth.uid() = user_id);

create index if not exists user_settings_user_id_idx on public.user_settings(user_id);

-- Seed the initial catalog of settings.
insert into public.setting_items (key, label, description, data_type, default_value) values
  ('theme', 'Theme', 'Light or dark appearance.', 'string', '"light"'),
  ('auto_lock_ms', 'Auto-lock timeout', 'How long before the vault locks after inactivity.', 'number', '300000'),
  ('reveal_password_default', 'Show passwords by default', 'Show passwords in plain text on the dashboard instead of masked.', 'boolean', 'false'),
  ('expand_all_items_default', 'Expand "All items" by default', 'Keep the full entry list expanded instead of collapsed.', 'boolean', 'false')
on conflict (key) do nothing;
