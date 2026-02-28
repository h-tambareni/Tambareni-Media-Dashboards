-- Move realtalkdiariespodcast Instagram from Raw Truth brand to Real Talk Diaries brand
-- Identify brands by their existing channels (more reliable than name matching)

-- 1. Delete from Raw Truth brand (the brand that has rawtruth.podcast)
delete from brand_channels
where channel_handle = 'realtalkdiariespodcast'
  and platform = 'instagram'
  and brand_id in (
    select brand_id from brand_channels
    where channel_handle in ('rawtruth.podcast', 'rawtruthpodcast')
    limit 1
  );

-- 2. Add to Real Talk Diaries brand (the brand that has realtalkdiariespodcast YouTube)
insert into brand_channels (brand_id, channel_handle, platform, active)
select bc.brand_id, 'realtalkdiariespodcast', 'instagram', true
from brand_channels bc
where bc.channel_handle = 'realtalkdiariespodcast'
  and bc.platform in ('youtube', 'tiktok')
limit 1
on conflict (brand_id, channel_handle, platform) do update set active = true;
