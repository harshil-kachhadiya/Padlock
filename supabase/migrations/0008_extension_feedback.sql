-- Anonymous uninstall feedback from the browser extension. No auth — by the
-- time this page loads, the extension (and its session) is already gone.
-- Run this manually in the Supabase SQL editor.

create table if not exists public.extension_feedback (
  id uuid primary key default gen_random_uuid(),
  reason text,
  message text,
  created_at timestamptz not null default now()
);

alter table public.extension_feedback enable row level security;

-- Insert-only, open to anyone (anon key) — no select policy, so submitted
-- feedback is only readable from the Supabase dashboard, never from the app.
create policy "extension_feedback_insert_anyone"
  on public.extension_feedback for insert
  to anon, authenticated
  with check (
    char_length(coalesce(reason, '')) <= 100
    and char_length(coalesce(message, '')) <= 2000
  );
