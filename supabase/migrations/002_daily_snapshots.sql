-- Daily view snapshots for building views-over-time charts
-- Stored once per channel per day on each sync
CREATE TABLE IF NOT EXISTS daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_handle TEXT NOT NULL,
  platform TEXT DEFAULT 'youtube',
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_views BIGINT DEFAULT 0,
  followers BIGINT DEFAULT 0,
  video_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_handle, platform, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_snapshots_handle ON daily_snapshots(channel_handle, platform);
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_date ON daily_snapshots(snapshot_date);

-- Update brand_channels to support multiple platforms + active toggle
ALTER TABLE brand_channels DROP CONSTRAINT IF EXISTS brand_channels_brand_id_channel_handle_key;
ALTER TABLE brand_channels DROP CONSTRAINT IF EXISTS brand_channels_brand_platform_handle_key;
ALTER TABLE brand_channels ADD CONSTRAINT brand_channels_brand_platform_handle_key UNIQUE(brand_id, channel_handle, platform);
ALTER TABLE brand_channels ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Enable RLS
ALTER TABLE daily_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on daily_snapshots" ON daily_snapshots;
CREATE POLICY "Allow all on daily_snapshots" ON daily_snapshots FOR ALL USING (true) WITH CHECK (true);
