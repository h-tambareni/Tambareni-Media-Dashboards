-- =============================================================================
-- CRON CONFIG SETUP – run this once in Supabase SQL Editor
-- =============================================================================
--
-- FLOW:
--   pg_cron (11:59 PM daily)
--     → reads cron_config.daily_sync_url
--     → HTTP GET to that URL (your daily-sync Edge Function)
--     → daily-sync reads cron_config.instagram_tokens (or INSTAGRAM_TOKENS secret)
--
-- TWO ROWS YOU NEED:
--   1. daily_sync_url  – where pg_cron hits (URL + secret)
--   2. instagram_tokens – your actual tokens (copy from .env VITE_INSTAGRAM_TOKENS)
--
-- =============================================================================

-- 1. DAILY SYNC URL
--    Replace YOUR_CRON_SECRET with the same value you used in: npx supabase secrets set CRON_SECRET=...
--    If you never set CRON_SECRET, use any string (e.g. my-secret-123) and set it: npx supabase secrets set CRON_SECRET=my-secret-123
insert into cron_config (key, value) values (
  'daily_sync_url',
  'https://lbfkezeeqzaevvphevfa.supabase.co/functions/v1/daily-sync?secret=YOUR_CRON_SECRET'
) on conflict (key) do update set value = excluded.value;


-- 2. INSTAGRAM TOKENS
--    Open .env, copy everything after "VITE_INSTAGRAM_TOKENS=" on line 12.
--    Paste it between the quotes below (replace PASTE_FROM_ENV).
insert into cron_config (key, value) values (
  'instagram_tokens',
  'PASTE_FROM_ENV'
) on conflict (key) do update set value = excluded.value;


-- After running: verify
-- select * from cron_config;
