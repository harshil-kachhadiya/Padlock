-- Extension session and entry-list preferences.
-- Run this manually in the Supabase SQL editor.

insert into public.setting_items (key, label, description, data_type, default_value) values
  (
    'lock_chrome_by_default',
    'Lock extension when Chrome starts',
    'Require the master password again after Chrome is closed and reopened. When off, the extension stays unlocked until you click Lock.',
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