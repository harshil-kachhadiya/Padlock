-- Atomically rotate a user's salt/verifier and re-encrypt all their passwords
-- in one transaction, so a change-master-password flow can't leave some
-- entries encrypted under the old key and others under the new one.
-- Run this manually in the Supabase SQL editor.

create or replace function public.change_master_password(
  p_salt jsonb,
  p_verifier jsonb,
  p_updates jsonb -- array of {"id": "<passwords.id>", "encrypted_password": {"iv": [...], "data": [...]}}
)
returns void
language plpgsql
security invoker
as $$
begin
  update public.users
  set salt = p_salt,
      verifier = p_verifier
  where id = auth.uid();

  update public.passwords p
  set encrypted_password = u.encrypted_password
  from jsonb_to_recordset(p_updates) as u(id uuid, encrypted_password jsonb)
  where p.id = u.id
    and p.user_id = auth.uid();
end;
$$;

revoke all on function public.change_master_password(jsonb, jsonb, jsonb) from public;
grant execute on function public.change_master_password(jsonb, jsonb, jsonb) to authenticated;
