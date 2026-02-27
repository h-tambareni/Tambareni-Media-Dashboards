-- Remove legacy channel_cache rows where a composite-key row already exists
-- Legacy: channel_handle = "tambarenicareers"
-- Composite: channel_handle = "tambarenicareers::tiktok"
-- Prevents stale/duplicate data; getCachedChannelWithFallback prefers composite
DELETE FROM channel_cache c1
WHERE c1.channel_handle NOT LIKE '%::%'
AND EXISTS (
  SELECT 1 FROM channel_cache c2
  WHERE c2.channel_handle = c1.channel_handle || '::' || COALESCE(
    c1.raw_platform_json->'platform'->>'platformType',
    c1.raw_platform_json->'channel'->>'platform',
    'youtube'
  )
);
