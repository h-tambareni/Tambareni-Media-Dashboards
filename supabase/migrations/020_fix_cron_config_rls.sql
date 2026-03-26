-- cron_config has RLS enabled but no policies, so the anon client can neither
-- read nor write sync timestamps. Add "allow all" so the dashboard can track
-- last_manual_sync and last_daily_sync_cron.

ALTER TABLE public.cron_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on cron_config" ON public.cron_config;
CREATE POLICY "Allow all on cron_config" ON public.cron_config
  FOR ALL USING (true) WITH CHECK (true);
