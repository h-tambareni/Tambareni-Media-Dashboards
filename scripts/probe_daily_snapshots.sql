-- Probe daily_snapshots for Daily Growth chart anomalies
-- Run in Supabase Dashboard → SQL Editor

-- 1. Top total_views (potential bad data)
SELECT snapshot_date, channel_handle, platform, total_views, followers
FROM daily_snapshots
ORDER BY total_views DESC
LIMIT 20;

-- 2. Days with highest aggregate
SELECT snapshot_date, SUM(total_views) as day_total, COUNT(*) as channel_count
FROM daily_snapshots
GROUP BY snapshot_date
ORDER BY day_total DESC
LIMIT 15;

-- 3. First-day snapshots (no prior day) – these caused the 7.7M spike
-- When a new channel appears, its full cumulative was counted as "growth"
WITH with_prev AS (
  SELECT ds.*,
    LAG(total_views) OVER (PARTITION BY channel_handle, platform ORDER BY snapshot_date) as prev_views
  FROM daily_snapshots ds
)
SELECT channel_handle, platform, snapshot_date, total_views, prev_views
FROM with_prev
WHERE prev_views IS NULL AND total_views > 100000
ORDER BY total_views DESC;
