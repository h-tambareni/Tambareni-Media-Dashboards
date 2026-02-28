-- Ensure realtalkdiariespodcast Instagram is in Real Talk Diaries brand.
-- Find brand by: realtalkdiariespodcast (youtube) OR realtalkdiariess (tiktok) OR name ilike real talk diaries
insert into brand_channels (brand_id, channel_handle, platform, active)
select b.id, 'realtalkdiariespodcast', 'instagram', true
from brands b
where b.id in (
  select brand_id from brand_channels 
  where (channel_handle = 'realtalkdiariespodcast' and platform in ('youtube','tiktok'))
     or (channel_handle = 'realtalkdiariess' and platform in ('youtube','tiktok'))
  limit 1
)
limit 1
on conflict (brand_id, channel_handle, platform) do update set active = true;
