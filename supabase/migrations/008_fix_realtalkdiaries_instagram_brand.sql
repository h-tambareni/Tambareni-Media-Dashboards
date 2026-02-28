-- Move realtalkdiariespodcast Instagram from Raw Truth brand to Real Talk Diaries brand
-- 1. Delete the wrong association (Raw Truth)
delete from brand_channels
where channel_handle = 'realtalkdiariespodcast'
  and platform = 'instagram'
  and brand_id in (select id from brands where lower(name) like '%raw truth%');

-- 2. Add to correct brand (Real Talk Diaries)
insert into brand_channels (brand_id, channel_handle, platform, active)
select id, 'realtalkdiariespodcast', 'instagram', true
from brands
where lower(trim(name)) like '%real talk diaries%'
limit 1
on conflict (brand_id, channel_handle, platform) do update set active = true;
