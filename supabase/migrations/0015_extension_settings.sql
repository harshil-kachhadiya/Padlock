-- Extension session and entry-list preferences.
-- Run this manually in the Supabase SQL editor.

insert into public.setting_items (key, label, description, data_type, default_value) values
  (
    'lock_chrome_by_default',
    'Lock Padlock when Chrome starts',
    'Require the Padlock master password again after Chrome is closed and reopened. Chrome itself is not locked.',
    'boolean',
    'false'
  ),
  (
    'show_all_items',
    'Show all items in the extension',
    'Show the full All items section in the extension popup. When off, the popup only shows entries matching the current website.',
    'boolean',
    'false'
  )
on conflict (key) do nothing;

update public.setting_items
set
  label = 'Lock Padlock when Chrome starts',
  description = 'Require the Padlock master password again after Chrome is closed and reopened. Chrome itself is not locked.'
where key = 'lock_chrome_by_default';

update public.setting_items
set default_value = '"system"'
where key = 'theme';

update public.setting_items
set default_value = 'true'
where key = 'auto_fill_single_match';