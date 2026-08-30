-- New setting: a hard override that disables revealing saved vault-entry
-- passwords anywhere on the website (dashboard, export, add/edit forms).
-- Does not affect master-password fields (setup/unlock/change-password),
-- which need their own reveal for typo-checking regardless.
-- Run this manually in the Supabase SQL editor.

insert into public.setting_items (key, label, description, data_type, default_value) values
  (
    'never_show_passwords',
    'Never show passwords',
    'Disables revealing saved passwords anywhere on the website — dashboard, export, and add/edit forms always stay masked.',
    'boolean',
    'false'
  )
on conflict (key) do nothing;
