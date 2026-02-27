-- Instagram OAuth tokens for brand_channels (platform=instagram)
-- Access token and expiry; used by Edge Functions to fetch Instagram API data
ALTER TABLE brand_channels ADD COLUMN IF NOT EXISTS instagram_user_id TEXT;
ALTER TABLE brand_channels ADD COLUMN IF NOT EXISTS instagram_access_token TEXT;
ALTER TABLE brand_channels ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_brand_channels_instagram_user ON brand_channels(instagram_user_id) WHERE platform = 'instagram';
