-- Remove realtalkdiariess Instagram from everywhere, then re-add to Real Talk Diaries brand only.
-- Uses realktalkdiariess handle (matches .env token key).

-- 1. Remove from all brands
delete from brand_channels
where channel_handle = 'realktalkdiariess' and platform = 'instagram';

-- Also remove any legacy/variant handles that might exist
delete from brand_channels
where platform = 'instagram'
  and channel_handle in ('realtalkdiariespodcast', 'realtalkdiariess');

-- 2. Clear cache
delete from channel_cache where channel_handle in (
  'realktalkdiariess::instagram',
  'realtalkdiariespodcast::instagram',
  'realtalkdiariess::instagram',
  'realktalkdiariess',
  'realtalkdiariespodcast',
  'realtalkdiariess'
);

-- 3. Re-add to Real Talk Diaries Podcast brand
insert into brand_channels (brand_id, channel_handle, platform, active)
select bc.brand_id, 'realktalkdiariess', 'instagram', true
from brand_channels bc
where bc.channel_handle in ('realtalkdiariespodcast','realtalkdiariess','realktalkdiariess')
  and bc.platform in ('youtube','tiktok')
limit 1
on conflict (brand_id, channel_handle, platform) do update set active = true;
