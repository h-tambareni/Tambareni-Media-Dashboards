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
  return map[h] || Object.values(map)[0] || null;
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

  const mediaRes = await fetch(
    `${IG_API}/${userId}/media?fields=id,media_type,media_url,thumbnail_url,timestamp,caption,like_count,comments_count&limit=50&access_token=${token}`
  );
  const mediaData = await mediaRes.json();
  const mediaList = mediaData.data || [];

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
    mediaList.slice(0, 25).map(async (m) => {
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
      subscribers: me.followers_count ?? 0,
      viewCount: totalViews,
      videoCount: me.media_count ?? 0,
      thumbnail: me.profile_picture_url,
      platform: "instagram",
    },
    platform: {
      handle: me.username,
      displayName: me.name || me.username,
      followers: me.followers_count ?? 0,
      channelId: userId,
      thumbnail: me.profile_picture_url,
      platformType: "instagram",
    },
    posts,
    totalViews,
    dailyViews: [],
  };
}
