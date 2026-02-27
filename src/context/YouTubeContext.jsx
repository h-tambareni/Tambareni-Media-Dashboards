/**
 * Platform context — fetches channel + video data via ScrapeCreators API.
 * Supports YouTube and TikTok. Caches snapshots in Supabase channel_cache.
 * Stores daily view totals for views-over-time chart.
 */
import { createContext, useContext, useState, useCallback } from "react";
import { fetchYTChannel, fetchYTChannelVideos, fetchTTProfile, fetchTTProfileVideos } from "../lib/scrapeCreators";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  getCachedChannel, isCacheFresh, parseCachedSnapshot,
  upsertChannelCache, upsertDailySnapshot, fetchDailySnapshots,
} from "../lib/supabaseDb";

const PlatformContext = createContext(null);
const inFlight = new Map();

export function YouTubeProvider({ children }) {
  const apiKey = import.meta.env.VITE_SCRAPECREATORS_API_KEY || "";
  const [channels, setChannels] = useState({});
  const [connectedHandles, setConnectedHandles] = useState([]);

  const removeChannel = useCallback((handleOrName) => {
    setChannels((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (next[k].platform?.handle === handleOrName || next[k].channel?.title === handleOrName || k === handleOrName) delete next[k];
      });
      return next;
    });
    setConnectedHandles((prev) => prev.filter((h) => h !== handleOrName));
  }, []);

  const fetchChannel = useCallback(
    async (handleOrName, platformHint = "youtube", forceRefresh = false) => {
      if (!apiKey) throw new Error("VITE_SCRAPECREATORS_API_KEY not set");
      const handle = (handleOrName?.trim() || "").replace(/^@/, "");
      const plat = platformHint || "youtube";
      const cacheKey = `${handle}:${plat}:${forceRefresh}`;

      const existing = inFlight.get(cacheKey);
      if (existing) return existing;

      const doFetch = async () => {
        try {
          if (isSupabaseConfigured() && !forceRefresh) {
            const cached = await getCachedChannel(handle);
            if (isCacheFresh(cached)) {
              const snap = parseCachedSnapshot(cached);
              if (snap) {
                const keys = [snap.channel?.title, snap.channel?.handle, handle].filter(Boolean);
                setChannels((prev) => { const n = { ...prev }; keys.forEach(k => n[k] = snap); return n; });
                setConnectedHandles((prev) => prev.includes(handle) ? prev : [...prev, handle]);
                return snap;
              }
            }
          }

          let ch, videos;
          if (plat === "tiktok") {
            ch = await fetchTTProfile(apiKey, handle);
            videos = await fetchTTProfileVideos(apiKey, handle);
          } else {
            ch = await fetchYTChannel(apiKey, handle);
            videos = await fetchYTChannelVideos(apiKey, handle);
          }

          const posts = videos.map(v => ({
            id: v.id,
            cap: v.title || "(Untitled)",
            views: v.views ?? 0,
            likes: v.likes ?? 0,
            cmts: v.comments ?? 0,
            shares: v.shares ?? 0,
            plat: plat === "tiktok" ? "tt" : "yt",
            emoji: plat === "tiktok" ? "🎵" : "▶️",
            thumbnail: v.thumbnail,
            publishedAt: v.publishedAt,
          }));

          posts.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
          const postViews = posts.reduce((s, p) => s + p.views, 0);
          const totalV = ch.viewCount || postViews;
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
            platformType: plat,
          };

          let dailyViews = [];
          if (isSupabaseConfigured()) {
            dailyViews = (await fetchDailySnapshots(handle, plat)).map(row => ({
              d: formatChartDate(row.snapshot_date),
              raw: row.snapshot_date,
              views: row.total_views,
            }));
          }

          const entry = {
            channel: ch,
            platform: platformData,
            posts,
            totalViews: totalV,
            dailyViews,
          };

          const keys = [ch.title, ch.handle, handle].filter(Boolean);
          setChannels((prev) => { const n = { ...prev }; keys.forEach(k => n[k] = entry); return n; });
          setConnectedHandles((prev) => prev.includes(handle) || prev.includes(ch.title) ? prev : [...prev, handle || ch.title]);

          if (isSupabaseConfigured()) {
            upsertChannelCache(handle, entry).catch(() => {});
            upsertDailySnapshot(handle, plat, {
              totalViews: totalV,
              followers: ch.subscribers,
              videoCount: ch.videoCount,
            }).catch(() => {});
          }
          return entry;
        } finally {
          inFlight.delete(cacheKey);
        }
      };
      const p = doFetch();
      inFlight.set(cacheKey, p);
      return p;
    },
    [apiKey]
  );

  const value = {
    apiKey: !!apiKey,
    fetchChannel,
    removeChannel,
    channelData: channels,
    connectedHandles,
  };

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function useYouTubeContext() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error("useYouTubeContext must be used within YouTubeProvider");
  return ctx;
}

function formatTimeAgo(iso) {
  const d = new Date(iso); const now = new Date(); const diff = (now - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 172800) return "1d ago";
  if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
  if (diff < 2592000) return Math.floor(diff / 604800) + "w ago";
  if (diff < 31536000) return Math.floor(diff / 2592000) + "mo ago";
  return Math.floor(diff / 31536000) + "y ago";
}

function formatChartDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}
