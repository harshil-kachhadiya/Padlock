-- Track when a password's value actually last changed, separate from when the
-- row was first created — needed for "this password is old" health checks.
-- Run this manually in the Supabase SQL editor.

alter table public.passwords add column if not exists updated_at timestamptz;

-- Backfill existing rows to their original creation time (not "now"), so
-- pre-existing passwords aren't falsely reported as just-changed.
update public.passwords set updated_at = created_at where updated_at is null;

alter table public.passwords alter column updated_at set default now();
alter table public.passwords alter column updated_at set not null;
