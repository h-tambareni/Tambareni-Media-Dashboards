/**
 * ScrapeCreators API wrapper for YouTube + TikTok
 * Docs: https://docs.scrapecreators.com
 * When apiKey is null/empty and Supabase is configured, uses Edge Function proxy (keeps key server-side)
 */

const BASE = "https://api.scrapecreators.com";

async function sc(path, params, apiKey) {
  const useProxy = !apiKey && import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;
  let res, data;
  if (useProxy) {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
    res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrapecreators-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify({ path: path.startsWith("/") ? path : `/${path}`, params: params || {} }),
    });
    data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data?.error || data?.message || `Proxy: HTTP ${res.status}`;
      if (res.status === 401) throw new Error(`${errMsg} (check SCRAPECREATORS_API_KEY in Supabase secrets or use VITE_SCRAPECREATORS_API_KEY in .env)`);
      throw new Error(errMsg);
    }
    return data;
  }
  if (!apiKey) throw new Error("ScrapeCreators: Set VITE_SCRAPECREATORS_API_KEY or configure Supabase + SCRAPECREATORS_API_KEY secret");
  const sp = new URLSearchParams(params);
  const url = `${BASE}${path}?${sp}`;
  res = await fetch(url, { headers: { "x-api-key": apiKey } });
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

function extractYTThumbnail(data) {
  const sources = data?.avatar?.image?.sources || [];
  if (sources.length) {
    const best = sources[sources.length - 1]?.url || sources[0]?.url;
    if (best) return best;
  }
  if (data?.avatar?.url) return data.avatar.url;
  if (data?.thumbnail) return typeof data.thumbnail === "string" ? data.thumbnail : data.thumbnail?.url;
  return null;
}

function extractHandleFromChannelUrl(channelUrl) {
  if (!channelUrl || typeof channelUrl !== "string") return null;
  const m = channelUrl.match(/@([a-zA-Z0-9_.@-]+)/);
  return m ? m[1].replace(/\.$/, "") : null;
}

export async function fetchYTChannel(apiKey, handle, opts = {}) {
  const { channelId: knownChannelId } = opts;
  const clean = (handle || "").replace(/^@/, "").trim();
  // ScrapeCreators: handle must NOT have @, and spaces cause 404. Try no-spaces first.
  const noSpaces = clean.replace(/\s+/g, "");
  const variants = [
    knownChannelId && { channelId: knownChannelId },
    noSpaces && { handle: noSpaces },
    clean !== noSpaces && { handle: clean },
    noSpaces && { url: `https://www.youtube.com/@${noSpaces}` },
  ].filter(Boolean);
  let data = null;
  let lastErr = null;
  for (const params of variants) {
    try {
      const res = await sc("/v1/youtube/channel", params, apiKey);
      const id = res?.channelId ?? res?.channel_id ?? res?.id;
      if (id) {
        data = { ...res, channelId: id };
        break;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  const finalId = data?.channelId ?? data?.channel_id ?? data?.id;
  if (!finalId) throw lastErr || new Error("Channel not found");
  const thumb = extractYTThumbnail(data);
  const canonicalHandle = extractHandleFromChannelUrl(data.channel) || data.handle || clean;
  return {
    id: finalId,
    handle: (canonicalHandle || clean).replace(/^@/, ""),
    channelUrl: data.channel,
    title: data.name,
    subscribers: data.subscriberCount ?? 0,
    viewCount: data.viewCount ?? 0,
    videoCount: data.videoCount ?? 0,
    thumbnail: thumb,
    description: data.description,
    country: data.country,
    platform: "youtube",
  };
}

function mapYTVideo(v) {
  const views = v.viewCountInt ?? v.viewCount ?? v.statistics?.viewCount ?? 0;
  const likes = v.likeCountInt ?? v.likeCount ?? v.statistics?.likeCount ?? 0;
  const comments = v.commentCountInt ?? v.commentCount ?? v.statistics?.commentCount ?? 0;
  const thumb = v.thumbnail ?? v.thumbnails?.high?.url ?? v.thumbnails?.medium?.url ?? v.thumbnails?.default?.url;
  const videoId = v.id || v.videoId;
  const thumbResolved = typeof thumb === "string" ? thumb : thumb?.url;
  return {
    id: videoId,
    title: v.title || v.name || v.snippet?.title || "(Untitled)",
    url: v.url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null),
    thumbnail: thumbResolved || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null),
    views: typeof views === "number" ? views : parseInt(String(views || 0), 10) || 0,
    likes: typeof likes === "number" ? likes : parseInt(String(likes || 0), 10) || 0,
    comments: typeof comments === "number" ? comments : parseInt(String(comments || 0), 10) || 0,
    publishedAt: v.publishedTime || v.publishDate || v.publishedAt || v.snippet?.publishedAt || null,
    duration: v.lengthSeconds ?? v.duration ?? v.contentDetails?.duration ?? 0,
    plat: "youtube",
  };
}

export async function fetchYTChannelVideos(apiKey, handle, opts = {}) {
  const { fullFetch = false, channelId = null, channelUrl = null, canonicalHandle = null } = opts;
  const clean = (handle || "").replace(/^@/, "");
  const handleToTry = (canonicalHandle || "").replace(/^@/, "") || clean;
  const all = [];
  const MAX_PAGES = fullFetch ? 150 : 1;

  // Prefer channelId first (most reliable), then handle, then url
  const strategies = [];
  if (channelId) strategies.push({ channelId });
  if (handleToTry) strategies.push({ handle: handleToTry });
  if (channelUrl) strategies.push({ url: channelUrl });
  if (clean && clean !== handleToTry) strategies.push({ handle: clean });

  for (const strategy of strategies) {
    if (all.length > 0) break;
    let token = null;
    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        const params = { ...strategy, sort: "latest" };
        if (token) params.continuationToken = token;
        const data = await sc("/v1/youtube/channel-videos", params, apiKey);
        const list = data.videos || data.items || data.results || data.data || [];
        if (list.length) {
          all.push(...list.map(mapYTVideo));
          const next = data.continuationToken || data.nextPageToken;
          if (!next || !fullFetch) break;
          token = next;
        } else break;
      }
    } catch (e) {
      console.warn(`[YT videos] strategy ${JSON.stringify(strategy)} failed:`, e.message);
    }
  }

  // Also try channel shorts endpoint if we have few/no results
  if (all.length < 5 && channelId) {
    try {
      const shortsData = await sc("/v1/youtube/channel/shorts", { channelId }, apiKey);
      const shortsList = shortsData.shorts || shortsData.videos || shortsData.items || [];
      if (shortsList.length) {
        all.push(...shortsList.map(mapYTVideo));
      }
    } catch (e) {
      console.warn("[YT shorts] failed:", e.message);
    }
  }
  if (all.length < 5 && handleToTry && !channelId) {
    try {
      const shortsData = await sc("/v1/youtube/channel/shorts", { handle: handleToTry }, apiKey);
      const shortsList = shortsData.shorts || shortsData.videos || shortsData.items || [];
      if (shortsList.length) {
        all.push(...shortsList.map(mapYTVideo));
      }
    } catch (e) {
      console.warn("[YT shorts by handle] failed:", e.message);
    }
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
