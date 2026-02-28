-- Fix Instagram brand assignments:
-- 1. Remove lovelogicpodcast::instagram from Real Talk Diaries (wrong brand)
-- 2. Add lovelogicpodcast::instagram to Love Logic brand if missing
-- 3. Add realtalkdiariespodcast::instagram to Real Talk Diaries brand if missing

-- Real Talk Diaries = brand that has realtalkdiariespodcast on youtube
-- Love Logic = brand that has lovelogicpodcast on youtube

-- 1. Remove Love Logic Instagram from Real Talk Diaries
delete from brand_channels
where channel_handle = 'lovelogicpodcast' and platform = 'instagram'
  and brand_id in (
    select bc.brand_id from brand_channels bc
    where bc.channel_handle = 'realtalkdiariespodcast' and bc.platform in ('youtube','tiktok')
    limit 1
  );

-- 2. Add Love Logic Instagram to Love Logic brand
insert into brand_channels (brand_id, channel_handle, platform, active)
select bc.brand_id, 'lovelogicpodcast', 'instagram', true
from brand_channels bc
where bc.channel_handle = 'lovelogicpodcast' and bc.platform in ('youtube','tiktok')
limit 1
on conflict (brand_id, channel_handle, platform) do update set active = true;

-- 3. Add Real Talk Diaries Instagram to Real Talk Diaries brand
insert into brand_channels (brand_id, channel_handle, platform, active)
select bc.brand_id, 'realtalkdiariespodcast', 'instagram', true
from brand_channels bc
where bc.channel_handle = 'realtalkdiariespodcast' and bc.platform in ('youtube','tiktok')
limit 1
on conflict (brand_id, channel_handle, platform) do update set active = true;
