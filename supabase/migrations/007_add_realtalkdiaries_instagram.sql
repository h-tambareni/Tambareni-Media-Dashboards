-- Add Real Talk Diaries Podcast Instagram account to its brand
insert into brand_channels (brand_id, channel_handle, platform, active)
select id, 'realtalkdiariespodcast', 'instagram', true
from brands
where lower(trim(name)) like '%real talk diaries%'
limit 1
on conflict (brand_id, channel_handle, platform) do update set active = true;
