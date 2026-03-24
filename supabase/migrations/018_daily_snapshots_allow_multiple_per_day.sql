-- Allow multiple rows per (channel_handle, platform, snapshot_date) for testing re-runs.
-- The dashboard keeps the latest row per day (max created_at) when building charts.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'daily_snapshots'
    AND con.contype = 'u'
  LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE daily_snapshots DROP CONSTRAINT %I', cname);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_daily_snapshots_handle_plat_date_created
  ON daily_snapshots (channel_handle, platform, snapshot_date, created_at DESC);
