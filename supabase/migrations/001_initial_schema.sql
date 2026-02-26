-- Tambareni Media Dashboards – initial schema
-- Run this in Supabase SQL Editor or via Supabase CLI

-- Brands: container for grouping accounts/channels
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#d63031',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Channels: YouTube (and future) channel links to brands
-- channel_handle = display name/handle we use for lookups (e.g. channel title from YouTube)
CREATE TABLE IF NOT EXISTS brand_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  channel_handle TEXT NOT NULL,
  platform TEXT DEFAULT 'youtube',
  youtube_channel_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(brand_id, channel_handle)
);

-- Optional: cache channel metadata to reduce API calls
CREATE TABLE IF NOT EXISTS channel_cache (
  channel_handle TEXT PRIMARY KEY,
  youtube_channel_id TEXT,
  subscribers BIGINT,
  video_count INT,
  last_synced_at TIMESTAMPTZ,
  raw_platform_json JSONB
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_brand_channels_brand_id ON brand_channels(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_channels_handle ON brand_channels(channel_handle);

-- Enable RLS (Row Level Security) – configure policies as needed
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_cache ENABLE ROW LEVEL SECURITY;

-- For now: allow all operations (adjust for auth later)
CREATE POLICY "Allow all on brands" ON brands FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on brand_channels" ON brand_channels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on channel_cache" ON channel_cache FOR ALL USING (true) WITH CHECK (true);
