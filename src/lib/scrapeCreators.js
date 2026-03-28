/**
 * ScrapeCreators API wrapper for YouTube, TikTok, and Instagram
 * Docs: https://docs.scrapecreators.com
 * When apiKey is null/empty and Supabase is configured, uses Edge Function proxy (keeps key server-side)
 *
 * Uses supabase.functions.invoke (not raw fetch) so the new sb_publishable_… key and JWT anon key
 * both work — manual fetch + publishable key can return 404 from the Functions gateway.
 */

import { supabase } from "./supabase";

const BASE = "https://api.scrapecreators.com";

/** Project ref from VITE_SUPABASE_URL (e.g. lbfkezeeqzaevvphevfa) — for error messages only. */
function supabaseProjectRef() {
  try {
    const h = new URL((import.meta.env.VITE_SUPABASE_URL || "").trim()).hostname;
    return h.split(".")[0] || "";
  } catch {
    return "";
  }
}

/**
 * Shared by YouTube, TikTok, Instagram (and any future platform). `apiKey` null + Supabase env
 * → proxy Edge Function; `apiKey` set → direct api.scrapecreators.com. Instagram-only Graph path
 * was removed — IG always goes through this same helper.
 */
/** Prefer caller key, then .env — avoids Edge proxy when VITE key exists but parent passed "". */
function resolveScrapeCreatorsKey(apiKey) {
  const fromCaller = apiKey && String(apiKey).trim();
  const fromEnv = (import.meta.env.VITE_SCRAPECREATORS_API_KEY || "").trim();
  return fromCaller || fromEnv || "";
}

async function sc(path, params, apiKey) {
  const directKey = resolveScrapeCreatorsKey(apiKey);
  const useProxy = !directKey && import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;
  let res, data;
  if (useProxy) {
    if (!supabase) {
      throw new Error("ScrapeCreators: Supabase client not initialized (check VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)");
    }
    const body = { path: path.startsWith("/") ? path : `/${path}`, params: params || {} };
    const { data: proxyData, error: fnError } = await supabase.functions.invoke("scrapecreators-proxy", { body });
    if (fnError) {
      const status = fnError.context?.status ?? 0;
      let detail = fnError.message;
      try {
        if (fnError.context && typeof fnError.context.json === "function") {
          const j = await fnError.context.json();
          if (j?.error || j?.message) detail = j.error || j.message;
        }
      } catch {
        /* ignore */
      }
      const errMsg = detail || `Proxy: HTTP ${status}`;
      const ref = supabaseProjectRef();
      const dash = ref ? `https://supabase.com/dashboard/project/${ref}/functions` : "Supabase Dashboard → Edge Functions";
      if (status === 401) throw new Error(`${errMsg} (check SCRAPECREATORS_API_KEY in Supabase secrets or use VITE_SCRAPECREATORS_API_KEY in .env)`);
      if (status === 404) {
        throw new Error(
          `ScrapeCreators proxy 404 — Supabase is not serving "scrapecreators-proxy" for project ${ref || "(check VITE_SUPABASE_URL)"}. ` +
            `Open ${dash} and confirm that function name exists (not only the secret). Migrations do not deploy functions; run: supabase functions deploy scrapecreators-proxy ` +
            `from this repo. Or set VITE_SCRAPECREATORS_API_KEY in .env to skip the proxy.`
        );
      }
      throw new Error(errMsg);
    }
    return proxyData;
  }
  if (!directKey) throw new Error("ScrapeCreators: Set VITE_SCRAPECREATORS_API_KEY or configure Supabase + SCRAPECREATORS_API_KEY secret");
  const sp = new URLSearchParams(params);
  const url = `${BASE}${path}?${sp}`;
  res = await fetch(url, { headers: { "x-api-key": directKey } });
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

/** Normalize ints from ScrapeCreators / platform JSON (shapes differ per endpoint). */
function coerceScInt(v) {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  const n = parseInt(String(v).replace(/,/g, "").trim(), 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function ytShareCount(v) {
  return Math.max(
    coerceScInt(v?.shares),
    coerceScInt(v?.shareCount),
    coerceScInt(v?.share_count),
    coerceScInt(v?.statistics?.shareCount),
    coerceScInt(v?.statistics?.share_count),
    coerceScInt(v?.engagement?.shares),
    coerceScInt(v?.engagement?.shareCount),
    coerceScInt(v?.social?.shares),
    coerceScInt(v?.metrics?.shares),
  );
}

/** IG hides total likes on some surfaces — read every field ScrapeCreators may send. */
function igLikeCount(base) {
  return Math.max(
    coerceScInt(base?.like_count),
    coerceScInt(base?.likes),
    coerceScInt(base?.edge_media_preview_like?.count),
    coerceScInt(base?.edge_liked_by?.count),
    coerceScInt(base?.edge_media_to_like?.count),
    coerceScInt(base?.likes_count),
    coerceScInt(base?.metrics?.likes),
    coerceScInt(base?.usertags?.count),
  );
}

function igShareCount(base) {
  return Math.max(
    coerceScInt(base?.share_count),
    coerceScInt(base?.fb_share_count),
    coerceScInt(base?.video_share_count),
    coerceScInt(base?.reshare_count),
    coerceScInt(base?.republish_count),
    coerceScInt(base?.edge_media_to_share_count?.count),
    coerceScInt(base?.media_share_count),
    coerceScInt(base?.social_share_count),
  );
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
    shares: ytShareCount(v),
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

  // Prefer channelId first (most reliable) - url param returns 400, skip it
  const strategies = [];
  if (channelId) strategies.push({ channelId });
  if (handleToTry) strategies.push({ handle: handleToTry });
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
    shares: ytShareCount(data),
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
  /** Lifetime total views when API exposes it; otherwise 0 and we rely on summing video plays. */
  const profileViewTotal =
    s.totalVideoViewCount ??
    s.videoViewCount ??
    s.video_view_count ??
    s.viewCount ??
    0;
  return {
    id: u.id,
    handle: u.uniqueId || handle,
    title: u.nickname || handle,
    subscribers: s.followerCount ?? 0,
    hearts: s.heartCount ?? 0,
    videoCount: s.videoCount ?? 0,
    viewCount: typeof profileViewTotal === "number" ? profileViewTotal : parseInt(String(profileViewTotal || 0), 10) || 0,
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

// ─── Instagram ──────────────────────────────────────────────────────────────

export async function fetchIGProfile(apiKey, handle) {
  const clean = (handle || "").replace(/^@/, "").trim();
  const raw = await sc("/v1/instagram/profile", { handle: clean }, apiKey);
  const data = raw?.data || raw;
  const user = data?.user || data;
  // v1 may resolve typo handles; v2 posts need the *canonical* username from the response.
  const usernameFromApi =
    (user?.username && String(user.username).replace(/^@/, "").trim()) ||
    (data?.username && String(data.username).replace(/^@/, "").trim()) ||
    (raw?.username && String(raw.username).replace(/^@/, "").trim()) ||
    clean;
  const id = user?.id ?? user?.pk ?? data?.id ?? raw?.id ?? null;
  const followedBy = user?.edge_followed_by?.count ?? user?.edge_followed_by ?? 0;
  const mediaCount = user?.edge_owner_to_timeline_media?.count ?? user?.edge_owner_to_timeline_media ?? 0;
  const followers = typeof followedBy === "number" ? followedBy : (followedBy?.count ?? 0);
  const videoCount = typeof mediaCount === "number" ? mediaCount : (mediaCount?.count ?? 0);
  const thumb = user?.profile_pic_url_hd || user?.profile_pic_url || user?.hd_profile_pic_url_info?.url || data?.profile_pic_url || null;
  return {
    id: id != null ? String(id) : undefined,
    handle: usernameFromApi,
    title: user?.full_name || user?.username || usernameFromApi || handle,
    subscribers: followers,
    videoCount,
    thumbnail: thumb,
    bio: user?.biography,
    platform: "instagram",
  };
}

function mapIGPost(item, handle) {
  const base = item?.node || item;
  // Reels expose play_count; older videos expose video_view_count. Take max to handle both.
  const views = Math.max(
    coerceScInt(base?.play_count),
    coerceScInt(base?.ig_play_count),
    coerceScInt(base?.video_view_count),
    coerceScInt(base?.view_count),
  );
  const cap = base?.caption;
  const caption = (typeof cap === "string" ? cap : cap?.text ?? "") || (base?.edge_media_to_caption?.edges?.[0]?.node?.text ?? "").slice(0, 200);
  const commentCount = base?.edge_media_to_comment?.count ?? base?.comment_count ?? 0;
  const shortcode = base?.code ?? base?.shortcode;
  return {
    id: base?.id ?? base?.pk ?? base?.strong_id__ ?? shortcode,
    title: caption || "(Untitled)",
    url: shortcode ? `https://www.instagram.com/p/${shortcode}/` : null,
    thumbnail: base?.display_uri ?? base?.display_url ?? base?.thumbnail_src,
    views: typeof views === "number" ? views : parseInt(String(views || 0), 10) || 0,
    likes: igLikeCount(base),
    comments: typeof commentCount === "number" ? commentCount : parseInt(String(commentCount || 0), 10) || 0,
    shares: igShareCount(base),
    publishedAt: (base?.taken_at ?? base?.taken_at_timestamp) ? new Date((base.taken_at ?? base.taken_at_timestamp) * 1000).toISOString() : null,
    duration: 0,
    plat: "instagram",
  };
}

/** ScrapeCreators v2 posts can 404 on typo / alternate spellings of handle while v1 profile still returns 200. */
function isPostsNotFoundError(e) {
  const s = String(e?.message || e);
  // Supabase proxy missing (function not deployed) — must not trigger IG "retry with user_id" logic.
  if (/scrapecreators-proxy|not serving.*scrapecreators-proxy|functions deploy/i.test(s)) return false;
  return /404|not found|HTTP 404|ScrapeCreators API:/i.test(s);
}

/**
 * @param {string} apiKey
 * @param {string} handle
 * @param {{ fullFetch?: boolean, userId?: string | number | null }} [opts]
 * `userId` = Instagram numeric id from `/v1/instagram/profile` — used when `handle` alone gets 404 on posts.
 */
export async function fetchIGPosts(apiKey, handle, opts = {}) {
  const { fullFetch = false, userId = null } = opts;
  const clean = (handle || "").replace(/^@/, "");
  const uid = userId != null && String(userId).trim() !== "" ? String(userId).trim() : null;
  const all = [];
  let maxId = null;
  /** Which param shape worked for page 0 (must stay consistent for pagination). */
  let mode = /** @type {null | "handle" | "uid" | "both"} */ (null);
  const MAX_PAGES = fullFetch ? 150 : 1;

  const fetchPostsPage = async () => {
    const base = maxId ? { next_max_id: maxId } : {};
    if (mode === "handle") return sc("/v2/instagram/user/posts", { handle: clean, ...base }, apiKey);
    if (mode === "uid") return sc("/v2/instagram/user/posts", { user_id: uid, ...base }, apiKey);
    if (mode === "both") return sc("/v2/instagram/user/posts", { handle: clean, user_id: uid, ...base }, apiKey);
    try {
      const data = await sc("/v2/instagram/user/posts", { handle: clean, ...base }, apiKey);
      mode = "handle";
      return data;
    } catch (e) {
      if (!uid || !isPostsNotFoundError(e)) throw e;
      try {
        const data = await sc("/v2/instagram/user/posts", { user_id: uid, ...base }, apiKey);
        mode = "uid";
        return data;
      } catch (e2) {
        const data = await sc("/v2/instagram/user/posts", { handle: clean, user_id: uid, ...base }, apiKey);
        mode = "both";
        return data;
      }
    }
  };

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await fetchPostsPage();
    const list = data?.items || data?.data || [];
    if (list.length) {
      for (const item of list) {
        const mapped = mapIGPost(item, clean);
        if (mapped.id) all.push(mapped);
      }
    }
    if (!fullFetch || !data?.more_available || !list.length) break;
    maxId = data?.next_max_id ?? data?.cursor ?? null;
    if (!maxId) break;
  }
  return all;
}
