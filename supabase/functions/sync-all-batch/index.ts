/**
 * Batch sync – fetches YouTube, TikTok, and Instagram channel + videos for multiple handles in one request.
 * Client makes one HTTP call; server fans out to ScrapeCreators in parallel.
 */
const SC_BASE = "https://api.scrapecreators.com";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const scKey = (Deno.env.get("SCRAPECREATORS_API_KEY") || "").trim();
    if (!scKey) {
      return Response.json({ error: "SCRAPECREATORS_API_KEY not configured" }, { status: 500, headers: { ...cors } });
    }

    const body = await req.json().catch(() => ({}));
    const items: { handle: string; platform: string; youtubeChannelId?: string }[] = body.items || body.handles || [];
    const filtered = items.filter((i) => {
      const p = (i.platform || "youtube").toLowerCase();
      const h = (i.handle || "").trim().replace(/^@/, "");
      return (p === "youtube" || p === "tiktok" || p === "instagram") && h;
    });

    if (!filtered.length) {
      return Response.json({ results: [], error: "No youtube/tiktok/instagram handles provided" }, { headers: { ...cors } });
    }

    const results = await Promise.all(
      filtered.map((item) => syncOne(item, scKey))
    );

    return Response.json({ results }, { headers: cors });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: cors });
  }
});

function ck(handle: string, platform: string): string {
  const h = (handle || "").toString().trim().toLowerCase().replace(/^@/, "");
  return `${h}::${(platform || "youtube").toLowerCase()}`;
}

async function sc(path: string, params: Record<string, string | number | undefined>, apiKey: string): Promise<any> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") sp.set(k, String(v));
  }
  const url = `${SC_BASE}${path}?${sp}`;
  const res = await fetch(url, { headers: { "x-api-key": apiKey } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data;
}

// ─── YouTube ───────────────────────────────────────────────────────────────

function extractYTThumbnail(data: any): string | null {
  const sources = data?.avatar?.image?.sources || [];
  if (sources.length) {
    const best = sources[sources.length - 1]?.url || sources[0]?.url;
    if (best) return best;
  }
  if (data?.avatar?.url) return data.avatar.url;
  if (data?.thumbnail) return typeof data.thumbnail === "string" ? data.thumbnail : data.thumbnail?.url;
  return null;
}

function extractHandleFromChannelUrl(channelUrl: string | null | undefined): string | null {
  if (!channelUrl || typeof channelUrl !== "string") return null;
  const m = channelUrl.match(/@([a-zA-Z0-9_.@-]+)/);
  return m ? m[1].replace(/\.$/, "") : null;
}

async function fetchYTChannel(apiKey: string, handle: string, opts: { channelId?: string }): Promise<any> {
  const { channelId: knownChannelId } = opts;
  const clean = (handle || "").replace(/^@/, "").trim();
  const noSpaces = clean.replace(/\s+/g, "");
  const variants = [
    knownChannelId && { channelId: knownChannelId },
    noSpaces && { handle: noSpaces },
    clean !== noSpaces && { handle: clean },
    noSpaces && { url: `https://www.youtube.com/@${noSpaces}` },
  ].filter(Boolean) as Record<string, string>[];

  let data: any = null;
  let lastErr: Error | null = null;
  for (const params of variants) {
    try {
      const res = await sc("/v1/youtube/channel", params, apiKey);
      const id = res?.channelId ?? res?.channel_id ?? res?.id;
      if (id) {
        data = { ...res, channelId: id };
        break;
      }
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
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
    platform: "youtube",
  };
}

function mapYTVideo(v: any): any {
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
    duration: v.lengthSeconds ?? v.duration ?? 0,
    plat: "youtube",
  };
}

async function fetchYTChannelVideos(apiKey: string, handle: string, opts: { channelId?: string; canonicalHandle?: string; fullFetch: boolean }): Promise<any[]> {
  const { channelId, canonicalHandle, fullFetch } = opts;
  const clean = (handle || "").replace(/^@/, "");
  const handleToTry = (canonicalHandle || "").replace(/^@/, "") || clean;
  const all: any[] = [];
  const MAX_PAGES = fullFetch ? 150 : 1;

  const strategies: Record<string, string>[] = [];
  if (channelId) strategies.push({ channelId });
  if (handleToTry) strategies.push({ handle: handleToTry });
  if (clean && clean !== handleToTry) strategies.push({ handle: clean });

  for (const strategy of strategies) {
    if (all.length > 0) break;
    let token: string | null = null;
    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        const params: Record<string, string> = { ...strategy, sort: "latest" };
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
    } catch (_) {}
  }

  if (all.length < 5 && channelId) {
    try {
      const shortsData = await sc("/v1/youtube/channel/shorts", { channelId }, apiKey);
      const shortsList = shortsData.shorts || shortsData.videos || shortsData.items || [];
      if (shortsList.length) all.push(...shortsList.map(mapYTVideo));
    } catch (_) {}
  }
  if (all.length < 5 && handleToTry && !channelId) {
    try {
      const shortsData = await sc("/v1/youtube/channel/shorts", { handle: handleToTry }, apiKey);
      const shortsList = shortsData.shorts || shortsData.videos || shortsData.items || [];
      if (shortsList.length) all.push(...shortsList.map(mapYTVideo));
    } catch (_) {}
  }

  return all;
}

// ─── TikTok ────────────────────────────────────────────────────────────────

async function fetchTTProfile(apiKey: string, handle: string): Promise<any> {
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

function mapTTVideo(v: any, handle: string): any {
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

async function fetchTTProfileVideos(apiKey: string, handle: string, opts: { fullFetch: boolean; userId?: string }): Promise<any[]> {
  const { fullFetch, userId } = opts;
  const clean = (handle || "").replace(/^@/, "");
  const all: any[] = [];
  let cursor: string | null = null;
  const MAX_PAGES = fullFetch ? 100 : 1;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params: Record<string, string> = { handle: clean, sort_by: "latest" };
    if (userId) params.user_id = String(userId);
    if (cursor) params.max_cursor = cursor;
    const data = await sc("/v3/tiktok/profile/videos", params, apiKey);
    const list = data.aweme_list || data.aweme_detail?.aweme_list || data.videos || [];
    const handleForUrl = clean || list[0]?.author?.unique_id || list[0]?.owner_handle || "tiktok";
    if (list.length) all.push(...list.map((v: any) => mapTTVideo(v, handleForUrl)));
    if (!fullFetch) break;
    const hasMore = data.has_more === 1 || data.has_more === true;
    const next = data.max_cursor ?? data.cursor ?? data.next_cursor;
    if (!hasMore || !list.length || next === cursor) break;
    cursor = next;
  }
  return all;
}

// ─── Instagram ────────────────────────────────────────────────────────────

async function fetchIGProfile(apiKey: string, handle: string): Promise<any> {
  const clean = (handle || "").replace(/^@/, "").trim();
  const raw = await sc("/v1/instagram/profile", { handle: clean }, apiKey);
  const data = raw?.data || raw;
  const user = data?.user || data;
  const followedBy = user?.edge_followed_by?.count ?? user?.edge_followed_by ?? 0;
  const mediaCount = user?.edge_owner_to_timeline_media?.count ?? user?.edge_owner_to_timeline_media ?? 0;
  const followers = typeof followedBy === "number" ? followedBy : (followedBy?.count ?? 0);
  const videoCount = typeof mediaCount === "number" ? mediaCount : (mediaCount?.count ?? 0);
  return {
    id: user?.id,
    handle: (user?.username || clean).replace(/^@/, ""),
    title: user?.full_name || user?.username || handle,
    subscribers: followers,
    videoCount,
    viewCount: 0,
    thumbnail: user?.profile_pic_url_hd || user?.profile_pic_url || null,
    bio: user?.biography,
    platform: "instagram",
  };
}

function mapIGPost(item: any, _handle: string): any {
  const base = item?.node || item;
  const views = base?.video_view_count ?? base?.play_count ?? base?.ig_play_count ?? 0;
  const cap = base?.caption;
  const caption = (typeof cap === "string" ? cap : cap?.text ?? "") || (base?.edge_media_to_caption?.edges?.[0]?.node?.text ?? "").slice(0, 200);
  const commentCount = base?.edge_media_to_comment?.count ?? base?.comment_count ?? 0;
  const likeCount = base?.edge_liked_by?.count ?? base?.like_count ?? 0;
  const shortcode = base?.code ?? base?.shortcode;
  return {
    id: base?.id ?? base?.pk ?? base?.strong_id__ ?? shortcode,
    title: caption || "(Untitled)",
    url: shortcode ? `https://www.instagram.com/p/${shortcode}/` : null,
    thumbnail: base?.display_uri ?? base?.display_url ?? base?.thumbnail_src,
    views: typeof views === "number" ? views : parseInt(String(views || 0), 10) || 0,
    likes: typeof likeCount === "number" ? likeCount : parseInt(String(likeCount || 0), 10) || 0,
    comments: typeof commentCount === "number" ? commentCount : parseInt(String(commentCount || 0), 10) || 0,
    shares: 0,
    publishedAt: (base?.taken_at ?? base?.taken_at_timestamp) ? new Date((base.taken_at ?? base.taken_at_timestamp) * 1000).toISOString() : null,
    duration: 0,
    plat: "instagram",
  };
}

async function fetchIGPosts(
  apiKey: string,
  handle: string,
  opts: { fullFetch: boolean; userId?: string | number | null },
): Promise<any[]> {
  const { fullFetch, userId } = opts;
  const clean = (handle || "").replace(/^@/, "");
  const uid = userId != null && String(userId).trim() !== "" ? String(userId).trim() : null;
  const all: any[] = [];
  let maxId: string | null = null;
  let mode: null | "handle" | "uid" | "both" = null;
  const MAX_PAGES = fullFetch ? 50 : 1;

  const is404 = (e: unknown) => /404|not found|HTTP 404/i.test(String(e instanceof Error ? e.message : e));

  for (let page = 0; page < MAX_PAGES; page++) {
    const base: Record<string, string> = {};
    if (maxId) base.next_max_id = maxId;

    let data: any;
    if (mode === "handle") {
      data = await sc("/v2/instagram/user/posts", { handle: clean, ...base }, apiKey);
    } else if (mode === "uid") {
      data = await sc("/v2/instagram/user/posts", { user_id: uid!, ...base }, apiKey);
    } else if (mode === "both") {
      data = await sc("/v2/instagram/user/posts", { handle: clean, user_id: uid!, ...base }, apiKey);
    } else {
      try {
        data = await sc("/v2/instagram/user/posts", { handle: clean, ...base }, apiKey);
        mode = "handle";
      } catch (e) {
        if (!uid || !is404(e)) throw e;
        try {
          data = await sc("/v2/instagram/user/posts", { user_id: uid, ...base }, apiKey);
          mode = "uid";
        } catch {
          data = await sc("/v2/instagram/user/posts", { handle: clean, user_id: uid, ...base }, apiKey);
          mode = "both";
        }
      }
    }

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

// ─── Sync one channel ─────────────────────────────────────────────────────

async function syncOne(
  item: { handle: string; platform: string; youtubeChannelId?: string },
  apiKey: string
): Promise<{ key: string; ok: boolean; entry?: any; error?: string }> {
  const handle = (item.handle || "").trim().replace(/^@/, "");
  const platform = (item.platform || "youtube").toLowerCase();
  const key = ck(handle, platform);

  try {
    let ch: any;
    let videos: any[];

    if (platform === "tiktok") {
      ch = await fetchTTProfile(apiKey, handle);
      videos = await fetchTTProfileVideos(apiKey, ch.handle || handle, { fullFetch: true, userId: ch.id });
    } else if (platform === "instagram") {
      ch = await fetchIGProfile(apiKey, handle);
      videos = await fetchIGPosts(apiKey, ch.handle || handle, { fullFetch: true, userId: ch.id ?? null });
    } else {
      ch = await fetchYTChannel(apiKey, handle, { channelId: item.youtubeChannelId });
      videos = await fetchYTChannelVideos(apiKey, handle, {
        fullFetch: true,
        channelId: ch.id,
        canonicalHandle: ch.handle,
      });
    }

    const newPostsRaw = videos.map((v) => ({
      id: v.id,
      cap: v.title || "(Untitled)",
      views: v.views ?? 0,
      likes: v.likes ?? 0,
      cmts: v.comments ?? 0,
      shares: v.shares ?? 0,
      plat: platform === "tiktok" ? "tt" : platform === "instagram" ? "ig" : "yt",
      emoji: platform === "tiktok" ? "🎵" : platform === "instagram" ? "📷" : "▶️",
      thumbnail: v.thumbnail,
      publishedAt: v.publishedAt,
    }));

    const byId = new Map();
    newPostsRaw.forEach((p) => {
      const existing = byId.get(p.id);
      if (!existing || (p.views || 0) > (existing.views || 0)) byId.set(p.id, p);
    });
    const posts = Array.from(byId.values()).sort(
      (a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
    );

    const postViews = posts.reduce((s, p) => s + p.views, 0);
    const totalV = Math.max(ch.viewCount ?? 0, postViews);
    const avgV = posts.length ? Math.round(postViews / posts.length) : 0;
    const lastPost = posts[0];

    const platformData = {
      handle: ch.handle || handle,
      displayName: ch.title || ch.handle || handle,
      followers: ch.subscribers ?? 0,
      avgViews: avgV >= 1000 ? (avgV / 1000).toFixed(1) + "K" : String(avgV),
      status: "active",
      last: lastPost?.publishedAt ? formatTimeAgo(lastPost.publishedAt) : "—",
      channelId: ch.id,
      thumbnail: ch.thumbnail,
      platformType: platform,
    };

    const entry = {
      channel: ch,
      platform: platformData,
      posts,
      totalViews: totalV,
      dailyViews: [],
      last_full_fetch_at: new Date().toISOString(),
    };

    return { key, ok: true, entry };
  } catch (e) {
    return { key, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 172800) return "1d ago";
  if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
  if (diff < 2592000) return Math.floor(diff / 604800) + "w ago";
  if (diff < 31536000) return Math.floor(diff / 2592000) + "mo ago";
  return Math.floor(diff / 31536000) + "y ago";
}
