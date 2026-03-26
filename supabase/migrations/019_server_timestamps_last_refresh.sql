-- Last refresh timestamps must come from Postgres (server time), not the browser.

-- 1) channel_cache: always set last_synced_at = now() on insert/update
CREATE OR REPLACE FUNCTION public.channel_cache_set_last_synced()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_synced_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_channel_cache_last_synced ON public.channel_cache;
CREATE TRIGGER tr_channel_cache_last_synced
  BEFORE INSERT OR UPDATE ON public.channel_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.channel_cache_set_last_synced();

-- 2) Record manual Sync All completion using DB clock (client calls RPC, no timestamp in JS)
CREATE OR REPLACE FUNCTION public.touch_last_manual_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cron_config (key, value)
  VALUES ('last_manual_sync', now()::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_last_manual_sync() TO anon, authenticated;
