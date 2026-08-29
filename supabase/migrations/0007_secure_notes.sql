-- Secure notes: a second entry type for arbitrary encrypted text (Wi-Fi
-- passwords, recovery codes, etc.), separate from site/password entries.
-- Run this manually in the Supabase SQL editor.

create table if not exists public.secure_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  encrypted_content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

alter table public.secure_notes enable row level security;

create policy "secure_notes_select_own"
  on public.secure_notes for select
  using (auth.uid() = user_id);

create policy "secure_notes_insert_own"
  on public.secure_notes for insert
  with check (auth.uid() = user_id);

create policy "secure_notes_update_own"
  on public.secure_notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "secure_notes_delete_own"
  on public.secure_notes for delete
  using (auth.uid() = user_id);

create index if not exists secure_notes_user_id_idx on public.secure_notes(user_id);
