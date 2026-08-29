-- Freeform tags per site, for filtering/organizing the vault. Plaintext by
-- design (like site_name/site_url) — tags describe the entry, they aren't
-- secret material.
-- Run this manually in the Supabase SQL editor.

alter table public.sites add column if not exists tags text[] not null default '{}';

create index if not exists sites_tags_idx on public.sites using gin (tags);
