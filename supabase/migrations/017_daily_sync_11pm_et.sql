-- Change daily sync to 11 PM Eastern Time
-- 04:00 UTC = 11 PM EST (winter) | 12 AM EDT (summer)
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
