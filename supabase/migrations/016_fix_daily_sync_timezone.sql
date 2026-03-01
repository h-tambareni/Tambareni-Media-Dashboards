-- Fix: pg_cron uses UTC. '59 23 * * *' was 11:59 PM UTC = 3:59 PM Pacific / 6:59 PM Eastern.
-- Change to 07:59 UTC = 11:59 PM Pacific (PST). For Eastern use '59 4 * * *'.
do $$
declare jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'daily-sync-1159' limit 1;
  if jid is not null then perform cron.unschedule(jid); end if;
exception when others then null;
end $$;

-- 07:59 UTC = 11:59 PM Pacific (PST) | 02:59 AM Eastern (EST) next day
select cron.schedule(
  'daily-sync-1159',
  '59 7 * * *',
  $$
  select net.http_get(
    url := (select value from cron_config where key = 'daily_sync_url' limit 1),
    timeout_milliseconds := 120000
  ) as request_id
  where exists (select 1 from cron_config where key = 'daily_sync_url' and value <> '');
  $$
);
