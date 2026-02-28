-- Remove wrongly added realktalkdiariess (typo handle) from brand_channels.
-- The correct handle is realtalkdiariespodcast, already under Real Talk Diaries.
delete from brand_channels
where channel_handle = 'realktalkdiariess'
  and platform = 'instagram';
