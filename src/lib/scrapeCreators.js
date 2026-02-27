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

export async function fetchYTChannelVideos(apiKey, handle) {
  const clean = handle.replace(/^@/, "");
  const data = await sc("/v1/youtube/channel-videos", { handle: clean, sort: "latest" }, apiKey);
  return (data.videos || []).map(v => ({
    id: v.id,
    title: v.title,
    url: v.url,
    thumbnail: v.thumbnail,
    views: v.viewCountInt ?? 0,
    publishedAt: v.publishedTime || null,
    duration: v.lengthSeconds ?? 0,
    plat: "youtube",
  }));
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

export async function fetchTTProfileVideos(apiKey, handle) {
  const data = await sc("/v3/tiktok/profile/videos", { handle: handle.replace(/^@/, ""), sort_by: "latest" }, apiKey);
  return (data.aweme_list || []).map(v => {
    const stats = v.statistics || {};
    return {
      id: v.aweme_id || String(v.id),
      title: v.desc || "(Untitled)",
      url: v.url || `https://www.tiktok.com/@${handle}/video/${v.aweme_id}`,
      thumbnail: v.video?.dynamic_cover?.url_list?.[0] || v.video?.cover?.url_list?.[0] || null,
      views: stats.play_count ?? 0,
      likes: stats.digg_count ?? 0,
      comments: stats.comment_count ?? 0,
      shares: stats.share_count ?? 0,
      publishedAt: v.create_time_utc || (v.create_time ? new Date(v.create_time * 1000).toISOString() : null),
      duration: v.video?.duration ?? 0,
      plat: "tiktok",
    };
  });
}
