-- New setting: when on, autofill shows an entry's hint instead of filling in
-- the real password, for entries that have one set.
-- Run this manually in the Supabase SQL editor.

insert into public.setting_items (key, label, description, data_type, default_value) values
  (
    'hint_only_mode',
    'Show hint instead of autofilling password',
    'When an entry has a hint set, autofill shows the hint instead of filling in the real password. Entries without a hint autofill normally.',
    'boolean',
    'false'
  )
on conflict (key) do nothing;
