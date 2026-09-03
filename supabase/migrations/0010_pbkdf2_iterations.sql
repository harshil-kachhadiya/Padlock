-- Store the PBKDF2 iteration count used for each user's key derivation,
-- instead of hardcoding it in application code.
--
-- Without this, raising the iteration count in a future release would change
-- what deriveKey(password, salt) produces for every existing user, and every
-- current vault would fail checkVerifier() on next unlock. Existing rows are
-- backfilled to 250,000 (the value the app has always used up to now) so they
-- keep unlocking unchanged; only new setups and master-password changes pick
-- up the new default.
alter table public.users
  add column if not exists pbkdf2_iterations integer not null default 250000;

comment on column public.users.pbkdf2_iterations is
  'PBKDF2 iteration count used to derive this user''s key from their master password. Recorded per-user so raising the app default does not invalidate existing vaults; a user only moves to the new count when they set or change their master password.';
