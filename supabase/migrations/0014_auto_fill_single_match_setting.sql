-- New setting: when a site has exactly one saved login, autofill it the
-- moment the popup opens instead of requiring a click. User-controlled and
-- off by default — filling a page without an explicit action is a real
-- enough behavior change that it should be opt-in, not a surprise.
-- Run this manually in the Supabase SQL editor.

insert into public.setting_items (key, label, description, data_type, default_value) values
  (
    'auto_fill_single_match',
    'Auto-fill when only one login is saved',
    'If a site has exactly one saved entry, fill it automatically when you open the popup — no need to click Autofill. Sites with more than one saved login still require a click.',
    'boolean',
    'false'
  )
on conflict (key) do nothing;
