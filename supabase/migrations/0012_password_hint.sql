-- Optional per-entry password hint, encrypted client-side exactly like the
-- password itself (AES-256-GCM under the vault key). Never stored in plain
-- text — a hint like "name@123" is a meaningful clue toward the real
-- password, so it gets the same zero-knowledge protection or none at all.
-- Run this manually in the Supabase SQL editor.

alter table public.passwords add column if not exists encrypted_hint jsonb;
