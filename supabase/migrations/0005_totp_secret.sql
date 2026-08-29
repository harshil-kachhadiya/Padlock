-- Optional TOTP (2FA) secret per site, encrypted client-side like everything
-- else — the server only ever sees ciphertext.
-- Run this manually in the Supabase SQL editor.

alter table public.sites add column if not exists encrypted_totp_secret jsonb;
