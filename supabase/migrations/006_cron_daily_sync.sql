-- Native Supabase cron: daily sync at 11:59 PM (no external tools)
-- Uses pg_cron + pg_net (built-in)

-- Enable extensions (idempotent)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Config table for cron URL (avoids hardcoding secrets in migrations)
create table if not exists cron_config (
  key text primary key,
  value text not null
);

comment on table cron_config is 'For daily-sync cron. Run once: insert into cron_config (key, value) values (''daily_sync_url'', ''https://YOUR_PROJECT.supabase.co/functions/v1/daily-sync?secret=YOUR_CRON_SECRET'') on conflict (key) do update set value = excluded.value;';

-- Unschedule existing job so we can re-create (idempotent)
do $$
declare jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'daily-sync-1159' limit 1;
  if jid is not null then perform cron.unschedule(jid); end if;
exception when others then null;
end $$;

-- Schedule: 11:59 PM every day (cron: min 59, hour 23)
select cron.schedule(
  'daily-sync-1159',
  '59 23 * * *',
  $$
  select net.http_get(
    url := (select value from cron_config where key = 'daily_sync_url' limit 1),
    timeout_milliseconds := 120000
  ) as request_id
  where exists (select 1 from cron_config where key = 'daily_sync_url' and value <> '');
  $$
);
