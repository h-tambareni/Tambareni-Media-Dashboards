/**
 * YouTube Data API v3 + Analytics API integration
 * @see docs/YOUTUBE_API_MAPPING.md for stat-to-API mapping
 */

const DATA_API_BASE = "https://www.googleapis.com/youtube/v3";
const ANALYTICS_API_BASE = "https://youtubeanalytics.googleapis.com/v2/reports";

/**
 * YouTube Data API – uses API key (works for public channel data)
 * Required: VITE_YOUTUBE_API_KEY in .env
 * Prefer fetchChannelById when youtube_channel_id is known – saves 100 units (avoids search fallback)
 */
export async function fetchChannelByHandle(apiKey, handle) {
  const cleanHandle = (handle?.replace(/^@/, "") ?? "").trim();
  if (!cleanHandle) return null;

  let ch = null;
  // forHandle = 1 unit; search = 100 units – always try forHandle first when no spaces
  if (!cleanHandle.includes(" ")) {
    const url = `${DATA_API_BASE}/channels?part=statistics,snippet,contentDetails&forHandle=${encodeURIComponent(cleanHandle)}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || err?.error?.errors?.[0]?.reason || `HTTP ${res.status}`;
      throw new Error(`YouTube Data API: ${msg}`);
    }
    const data = await res.json();
    if (data?.items?.length) ch = data.items[0];
  }
  if (!ch) {
    const searchUrl = `${DATA_API_BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(cleanHandle)}&maxResults=5&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      const err = await searchRes.json().catch(() => ({}));
      const msg = err?.error?.message || err?.error?.errors?.[0]?.reason || `HTTP ${searchRes.status}`;
      throw new Error(`YouTube Data API: ${msg}`);
    }
    const searchData = await searchRes.json();
    const channelId = searchData?.items?.[0]?.snippet?.channelId;
    if (channelId) {
      const chData = await fetchChannelById(apiKey, channelId);
      if (chData) return chData;
    }
    return null;
  }
  return {
    id: ch.id,
    handle: ch.snippet?.customUrl || ch.snippet?.title,
    title: ch.snippet?.title,
    subscribers: parseInt(ch.statistics?.subscriberCount || "0", 10),
    viewCount: parseInt(ch.statistics?.viewCount || "0", 10),
    videoCount: parseInt(ch.statistics?.videoCount || "0", 10),
    uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads,
    thumbnail: ch.snippet?.thumbnails?.default?.url,
  };
}

/**
 * Get channel by ID
 */
export async function fetchChannelById(apiKey, channelId) {
  const url = `${DATA_API_BASE}/channels?part=statistics,snippet,contentDetails&id=${encodeURIComponent(channelId)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || err?.error?.errors?.[0]?.reason || `HTTP ${res.status}`;
    throw new Error(`YouTube Data API: ${msg}`);
  }
  const data = await res.json();
  if (!data?.items?.length) return null;
  const ch = data.items[0];
  return {
    id: ch.id,
    handle: ch.snippet?.customUrl || ch.snippet?.title,
    title: ch.snippet?.title,
    subscribers: parseInt(ch.statistics?.subscriberCount || "0", 10),
    viewCount: parseInt(ch.statistics?.viewCount || "0", 10),
    videoCount: parseInt(ch.statistics?.videoCount || "0", 10),
    uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads,
    thumbnail: ch.snippet?.thumbnails?.default?.url,
  };
}

/**
 * Get recent uploads (video IDs + titles + publishedAt) from channel's uploads playlist
 */
export async function fetchUploads(apiKey, uploadsPlaylistId, maxResults = 50) {
  const url = `${DATA_API_BASE}/playlistItems?part=snippet&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=${maxResults}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || err?.error?.errors?.[0]?.reason || `HTTP ${res.status}`;
    throw new Error(`YouTube Data API: ${msg}`);
  }
  const data = await res.json();
  const items = (data.items || []).map((item) => ({
    videoId: item.snippet?.resourceId?.videoId,
    title: item.snippet?.title,
    publishedAt: item.snippet?.publishedAt,
    thumbnail: item.snippet?.thumbnails?.default?.url,
  }));
  return items;
}

/**
 * Get video statistics (views, likes, comments) and contentDetails (duration for skip rate)
 */
export async function fetchVideoStats(apiKey, videoIds) {
  if (!videoIds?.length) return [];
  const ids = videoIds.slice(0, 50).join(",");
  const url = `${DATA_API_BASE}/videos?part=statistics,contentDetails,snippet&id=${encodeURIComponent(ids)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || err?.error?.errors?.[0]?.reason || `HTTP ${res.status}`;
    throw new Error(`YouTube Data API: ${msg}`);
  }
  const data = await res.json();
  return (data.items || []).map((v) => ({
    id: v.id,
    title: v.snippet?.title,
    views: parseInt(v.statistics?.viewCount || "0", 10),
    likes: parseInt(v.statistics?.likeCount || "0", 10),
    comments: parseInt(v.statistics?.commentCount || "0", 10),
    duration: parseDuration(v.contentDetails?.duration),
    publishedAt: v.snippet?.publishedAt,
  }));
}

/**
 * Parse ISO 8601 duration (e.g. PT15M33S) to seconds
 */
function parseDuration(duration) {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (parseInt(h || "0", 10) * 3600) + (parseInt(m || "0", 10) * 60) + parseInt(s || "0", 10);
}

/**
 * YouTube Analytics API – requires OAuth 2.0 access token (channel owner)
 * Scopes: https://www.googleapis.com/auth/yt-analytics.readonly
 * @param accessToken - OAuth access token from Google Sign-In
 */
export async function fetchAnalyticsReport(accessToken, params) {
  const { ids = "channel==MINE", startDate, endDate, metrics, dimensions, filters, sort, maxResults } = params;
  const sp = new URLSearchParams({
    ids,
    "start-date": startDate,
    "end-date": endDate,
    metrics: metrics || "views",
  });
  if (dimensions) sp.set("dimensions", dimensions);
  if (filters) sp.set("filters", filters);
  if (sort) sp.set("sort", sort);
  if (maxResults) sp.set("max-results", String(maxResults));

  const url = `${ANALYTICS_API_BASE}?${sp}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `YouTube Analytics API: ${res.status}`);
  }
  const data = await res.json();
  return data;
}

/**
 * Daily views for views-over-time chart
 */
export async function fetchDailyViews(accessToken, channelId, startDate, endDate) {
  const ids = channelId ? `channel==${channelId}` : "channel==MINE";
  const data = await fetchAnalyticsReport(accessToken, {
    ids,
    startDate,
    endDate,
    metrics: "views",
    dimensions: "day",
    sort: "day",
  });
  const headers = data?.columnHeaders || [];
  const rows = data?.rows || [];
  const dayIdx = headers.findIndex((h) => h.name === "day");
  const viewsIdx = headers.findIndex((h) => h.name === "views");
  return rows.map((row) => ({
    d: formatChartDate(row[dayIdx]),
    raw: row[dayIdx],
    yt: Number(row[viewsIdx] || 0),
  }));
}

/**
 * Per-video metrics (views, likes, comments, shares, averageViewDuration) for post feed
 */
export async function fetchVideoAnalytics(accessToken, channelId, startDate, endDate, maxResults = 25) {
  const ids = channelId ? `channel==${channelId}` : "channel==MINE";
  const data = await fetchAnalyticsReport(accessToken, {
    ids,
    startDate,
    endDate,
    metrics: "views,likes,comments,shares,averageViewDuration",
    dimensions: "video",
    sort: "-views",
    maxResults,
  });
  const headers = data?.columnHeaders || [];
  const rows = data?.rows || [];
  const videoIdx = headers.findIndex((h) => h.name === "video");
  const viewsIdx = headers.findIndex((h) => h.name === "views");
  const likesIdx = headers.findIndex((h) => h.name === "likes");
  const commentsIdx = headers.findIndex((h) => h.name === "comments");
  const sharesIdx = headers.findIndex((h) => h.name === "shares");
  const avgDurIdx = headers.findIndex((h) => h.name === "averageViewDuration");

  return rows.map((row) => ({
    videoId: row[videoIdx],
    views: Number(row[viewsIdx] || 0),
    likes: Number(row[likesIdx] || 0),
    comments: Number(row[commentsIdx] || 0),
    shares: Number(row[sharesIdx] || 0),
    averageViewDurationSeconds: Number(row[avgDurIdx] || 0),
  }));
}

function formatChartDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}
