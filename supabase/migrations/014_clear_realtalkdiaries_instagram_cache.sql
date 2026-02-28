-- Clear stale channel_cache for Real Talk Diaries Instagram (had wrong followers data)
delete from channel_cache where channel_handle in (
  'realktalkdiariess::instagram',
  'realtalkdiariespodcast::instagram',
  'realtalkdiariess::instagram',
  'realktalkdiariess',
  'realtalkdiariespodcast',
  'realtalkdiariess'
);
