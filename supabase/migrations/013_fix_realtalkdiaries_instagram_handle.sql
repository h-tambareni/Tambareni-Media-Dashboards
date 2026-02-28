-- Use realktalkdiariess (matches .env VITE_INSTAGRAM_TOKENS key) for Real Talk Diaries Instagram.
-- 1. Remove wrong handles from Real Talk Diaries: lovelogicpodcast, realtalkdiariespodcast, realtalkdiariess
-- 2. Add realktalkdiariess::instagram to Real Talk Diaries

with rtd_brand as (
  select brand_id from brand_channels
  where channel_handle in ('realtalkdiariespodcast','realtalkdiariess','realktalkdiariess') and platform in ('youtube','tiktok')
  limit 1
)
delete from brand_channels
where platform = 'instagram'
  and channel_handle in ('lovelogicpodcast','realtalkdiariespodcast','realtalkdiariess')
  and brand_id in (select brand_id from rtd_brand);

insert into brand_channels (brand_id, channel_handle, platform, active)
select brand_id, 'realktalkdiariess', 'instagram', true
from brand_channels
where channel_handle in ('realtalkdiariespodcast','realtalkdiariess','realktalkdiariess') and platform in ('youtube','tiktok')
limit 1
on conflict (brand_id, channel_handle, platform) do update set active = true;
