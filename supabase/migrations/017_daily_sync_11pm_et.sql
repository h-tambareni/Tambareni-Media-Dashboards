-- pg_cron runs in UTC (not Eastern). This schedules daily-sync at 04:00 UTC.
-- 04:00 UTC ≈ 12:00 AM Eastern during EDT (roughly Mar–Nov).
-- 04:00 UTC ≈ 11:00 PM Eastern the *previous* calendar date during EST (roughly Nov–Mar).
-- For ~midnight Eastern in EST as well, use 05:00 UTC instead: '0 5 * * *'.
-- Verify the live job in Supabase Dashboard — your project may differ.
do $$
declare jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'daily-sync-1159' limit 1;
  if jid is not null then perform cron.unschedule(jid); end if;
exception when others then null;
end $$;

select cron.schedule(
  'daily-sync-1159',
  '0 4 * * *',
  $$
  select net.http_get(
    url := (select value from cron_config where key = 'daily_sync_url' limit 1),
    timeout_milliseconds := 120000
  ) as request_id
  where exists (select 1 from cron_config where key = 'daily_sync_url' and value <> '');
  $$
);
