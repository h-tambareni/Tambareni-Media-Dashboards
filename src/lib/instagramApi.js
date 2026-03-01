/**
 * Instagram API helpers – direct Graph API calls using tokens from .env
 * Tokens are stored as VITE_INSTAGRAM_TOKENS=handle1:token1,handle2:token2
 */

const IG_API = "https://graph.instagram.com/v25.0";

function getTokenMap() {
  const raw = import.meta.env.VITE_INSTAGRAM_TOKENS || "";
  const map = {};
  raw.split(",").forEach(pair => {
    const sep = pair.indexOf(":");
    if (sep > 0) {
      const handle = pair.slice(0, sep).trim().toLowerCase().replace(/^@/, "");
      const token = pair.slice(sep + 1).trim();
      if (handle && token) map[handle] = token;
    }
  });
  return map;
}

export function getInstagramToken(handle) {
  const h = (handle || "").toLowerCase().replace(/^@/, "");
  const map = getTokenMap();
  const token = map[h];
  if (!token) return null;
  return token;
}

export function hasInstagramTokens() {
  return Object.keys(getTokenMap()).length > 0;
}

export function getInstagramHandles() {
  return Object.keys(getTokenMap());
}

export async function fetchInstagramDirect(handle) {
  const token = getInstagramToken(handle);
  if (!token) throw new Error(`No Instagram token for "${handle}". Add it to VITE_INSTAGRAM_TOKENS in .env`);

  const meRes = await fetch(
    `${IG_API}/me?fields=id,username,name,profile_picture_url,followers_count,follows_count,media_count&access_token=${token}`
  );
  const me = await meRes.json();
  if (me.error) throw new Error(me.error.message || "Instagram API error");

  const userId = me.id;
  let followersCount = me.followers_count;

  // /me often omits followers_count (common with Instagram Login tokens).
  // Try graph.instagram.com/{id} then graph.facebook.com/{id} (IG User supports both hosts).
  const parseCount = (v) => {
    if (v == null || v === undefined) return null;
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  };
  followersCount = parseCount(followersCount);
  if (followersCount == null) {
    for (const base of [
      `https://graph.instagram.com/v25.0/${userId}?fields=followers_count`,
      `https://graph.facebook.com/v25.0/${userId}?fields=followers_count`,
    ]) {
      try {
        const r = await fetch(`${base}&access_token=${token}`);
        const j = await r.json();
        const val = j?.followers_count;
        if (val != null) {
          followersCount = parseCount(val);
          if (followersCount != null) break;
        }
      } catch {}
    }
  }
  if (followersCount == null) followersCount = 0;

  // Paginate to fetch ALL posts (API returns max 50 per page)
  const mediaList = [];
  let nextUrl = `${IG_API}/${userId}/media?fields=id,media_type,media_url,thumbnail_url,timestamp,caption,like_count,comments_count&limit=50&access_token=${token}`;
  while (nextUrl) {
    const mediaRes = await fetch(nextUrl);
    const mediaData = await mediaRes.json();
    if (mediaData.error) throw new Error(mediaData.error.message || "Instagram media API error");
    const chunk = mediaData.data || [];
    mediaList.push(...chunk);
    nextUrl = mediaData.paging?.next || null;
  }

  // Videos/Reels have views in Insights; photos/carousels do not. Fetch views per video.
  const fetchViews = async (mediaId, mediaType) => {
    const t = (mediaType || "").toUpperCase();
    if (t !== "VIDEO" && t !== "REELS") return 0;
    try {
      const r = await fetch(
        `${IG_API}/${mediaId}/insights?metric=views&access_token=${token}`
      );
      const j = await r.json();
      const val = j?.data?.[0]?.values?.[0]?.value ?? j?.data?.[0]?.total_value?.value;
      return typeof val === "number" ? val : 0;
    } catch {
      return 0;
    }
  };

  const postsWithViews = await Promise.all(
    mediaList.map(async (m) => {
      const views = await fetchViews(m.id, m.media_type);
      return {
        id: m.id,
        cap: (m.caption || "").slice(0, 100) || "(Untitled)",
        views,
        likes: m.like_count ?? 0,
        cmts: m.comments_count ?? 0,
        shares: 0,
        plat: "ig",
        emoji: "📷",
        thumbnail: m.thumbnail_url || m.media_url,
        publishedAt: m.timestamp,
      };
    })
  );
  const posts = postsWithViews;

  const totalViews = posts.reduce((s, p) => s + p.views, 0);

  return {
    channel: {
      id: userId,
      handle: me.username,
      title: me.name || me.username,
      subscribers: followersCount,
      viewCount: totalViews,
      videoCount: me.media_count ?? 0,
      thumbnail: me.profile_picture_url,
      platform: "instagram",
    },
    platform: {
      handle: me.username,
      displayName: me.name || me.username,
      followers: followersCount,
      channelId: userId,
      thumbnail: me.profile_picture_url,
      platformType: "instagram",
    },
    posts,
    totalViews,
    dailyViews: [],
  };
}
