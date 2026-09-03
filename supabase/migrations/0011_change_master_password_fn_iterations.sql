-- Extends change_master_password to also update pbkdf2_iterations, so that
-- rotating a master password moves the user onto the current default
-- iteration count (see 0010_pbkdf2_iterations.sql) instead of silently
-- keeping whatever count they were created with.
--
-- Run this manually in the Supabase SQL editor. Drops the old 3-argument
-- version first since Postgres treats a different parameter list as a
-- distinct function rather than an update to the existing one.

drop function if exists public.change_master_password(jsonb, jsonb, jsonb);

create or replace function public.change_master_password(
  p_salt jsonb,
  p_verifier jsonb,
  p_pbkdf2_iterations integer,
  p_updates jsonb -- array of {"id": "<passwords.id>", "encrypted_password": {"iv": [...], "data": [...]}}
)
returns void
language plpgsql
security invoker
as $$
begin
  update public.users
  set salt = p_salt,
      verifier = p_verifier,
      pbkdf2_iterations = p_pbkdf2_iterations
  where id = auth.uid();

  update public.passwords p
  set encrypted_password = u.encrypted_password
  from jsonb_to_recordset(p_updates) as u(id uuid, encrypted_password jsonb)
  where p.id = u.id
    and p.user_id = auth.uid();
end;
$$;

revoke all on function public.change_master_password(jsonb, jsonb, integer, jsonb) from public;
grant execute on function public.change_master_password(jsonb, jsonb, integer, jsonb) to authenticated;
