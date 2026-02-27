/**
 * ScrapeCreators API wrapper for YouTube + TikTok
 * Docs: https://docs.scrapecreators.com
 * Auth: x-api-key header
 */

const BASE = "https://api.scrapecreators.com";

async function sc(path, params, apiKey) {
  const sp = new URLSearchParams(params);
  const url = `${BASE}${path}?${sp}`;
  const res = await fetch(url, { headers: { "x-api-key": apiKey } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const code = res.status;
    const msg = code === 402 ? "ScrapeCreators: Out of credits" :
                code === 401 ? "ScrapeCreators: Invalid API key" :
                err?.message || `ScrapeCreators API: HTTP ${code}`;
    throw new Error(msg);
  }
  return res.json();
}

// ─── YouTube ───────────────────────────────────────────────────────────────

export async function fetchYTChannel(apiKey, handle) {
  const clean = handle.replace(/^@/, "");
  const data = await sc("/v1/youtube/channel", { handle: clean }, apiKey);
  const sources = data.avatar?.image?.sources || [];
  return {
    id: data.channelId,
    handle: (data.handle || clean).replace(/^@/, ""),
    title: data.name,
    subscribers: data.subscriberCount ?? 0,
    viewCount: data.viewCount ?? 0,
    videoCount: data.videoCount ?? 0,
    thumbnail: sources[sources.length - 1]?.url || sources[0]?.url || null,
    description: data.description,
    country: data.country,
    platform: "youtube",
  };
}

function mapYTVideo(v) {
  return {
    id: v.id,
    title: v.title,
    url: v.url,
    thumbnail: v.thumbnail,
    views: v.viewCountInt ?? 0,
    likes: v.likeCountInt ?? 0,
    comments: v.commentCountInt ?? 0,
    publishedAt: v.publishedTime || null,
    duration: v.lengthSeconds ?? 0,
    plat: "youtube",
  };
}

export async function fetchYTChannelVideos(apiKey, handle, opts = {}) {
  const { fullFetch = false } = opts;
  const clean = handle.replace(/^@/, "");
  const all = [];
  let token = null;
  const MAX_PAGES = fullFetch ? 150 : 1;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = { handle: clean, sort: "latest" };
    if (token) params.continuationToken = token;
    const data = await sc("/v1/youtube/channel-videos", params, apiKey);
    const list = data.videos || [];
    if (!list.length) break;
    all.push(...list.map(mapYTVideo));
    const next = data.continuationToken;
    if (!next || !fullFetch) break;
    token = next;
  }
  return all;
}

export async function fetchYTVideoDetails(apiKey, videoUrl) {
  const data = await sc("/v1/youtube/video", { url: videoUrl }, apiKey);
  return {
    id: data.id,
    title: data.title,
    views: data.viewCountInt ?? 0,
    likes: data.likeCountInt ?? 0,
    comments: data.commentCountInt ?? 0,
    thumbnail: data.thumbnail,
    publishedAt: data.publishDate,
    duration: Math.round((data.durationMs || 0) / 1000),
    plat: "youtube",
  };
}

// ─── TikTok ────────────────────────────────────────────────────────────────

export async function fetchTTProfile(apiKey, handle) {
  const data = await sc("/v1/tiktok/profile", { handle: handle.replace(/^@/, "") }, apiKey);
  const u = data.user || {};
  const s = data.stats || {};
  return {
    id: u.id,
    handle: u.uniqueId || handle,
    title: u.nickname || handle,
    subscribers: s.followerCount ?? 0,
    hearts: s.heartCount ?? 0,
    videoCount: s.videoCount ?? 0,
    thumbnail: u.avatarMedium || u.avatarLarger || u.avatarThumb || null,
    bio: u.signature,
    verified: u.verified ?? false,
    platform: "tiktok",
  };
}

function mapTTVideo(v, handle) {
  const stats = v.statistics || v.stats || {};
  const playCount = stats.play_count ?? stats.playCount ?? v.play_count ?? v.playCount ?? 0;
  return {
    id: v.aweme_id || v.aweme_detail?.aweme_id || String(v.id),
    title: v.desc || v.aweme_detail?.desc || "(Untitled)",
    url: v.url || (v.aweme_id ? `https://www.tiktok.com/@${handle}/video/${v.aweme_id}` : null),
    thumbnail: v.video?.dynamic_cover?.url_list?.[0] || v.video?.cover?.url_list?.[0] || v.aweme_detail?.video?.cover?.url_list?.[0] || null,
    views: playCount,
    likes: stats.digg_count ?? stats.diggCount ?? stats.like_count ?? 0,
    comments: stats.comment_count ?? stats.commentCount ?? 0,
    shares: stats.share_count ?? stats.shareCount ?? 0,
    publishedAt: v.create_time_utc || (v.create_time ? new Date(v.create_time * 1000).toISOString() : null),
    duration: v.video?.duration ?? 0,
    plat: "tiktok",
  };
}

export async function fetchTTProfileVideos(apiKey, handle, opts = {}) {
  const { fullFetch = false, userId = null } = opts;
  const clean = (handle || "").replace(/^@/, "");
  const all = [];
  let cursor = null;
  const MAX_PAGES = fullFetch ? 100 : 1;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = { handle: clean, sort_by: "latest" };
    if (userId) params.user_id = String(userId);
    if (cursor) params.max_cursor = cursor;
    const data = await sc("/v3/tiktok/profile/videos", params, apiKey);
    const list = data.aweme_list || data.aweme_detail?.aweme_list || data.videos || [];
    const handleForUrl = clean || list[0]?.author?.unique_id || list[0]?.owner_handle || "tiktok";
    if (list.length) all.push(...list.map(v => mapTTVideo(v, handleForUrl)));
    if (!fullFetch) break;
    const hasMore = data.has_more === 1 || data.has_more === true;
    const next = data.max_cursor ?? data.cursor ?? data.next_cursor;
    if (!hasMore || !list.length) break;
    if (next === cursor) break;
    cursor = next;
  }
  return all;
}
