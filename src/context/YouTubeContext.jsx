import { createContext, useContext, useState, useCallback } from "react";
import {
  fetchChannelByHandle,
  fetchUploads,
  fetchVideoStats,
  fetchDailyViews,
  fetchVideoAnalytics,
} from "../lib/youtube";

const YouTubeContext = createContext(null);

export function YouTubeProvider({ children }) {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY || "";
  const [channels, setChannels] = useState({});
  const [connectedHandles, setConnectedHandles] = useState([]);
  const [accessToken, setAccessToken] = useState(null);

  const setToken = useCallback((token) => setAccessToken(token), []);

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
    async (handleOrName) => {
      if (!apiKey) throw new Error("VITE_YOUTUBE_API_KEY not set");
      const handle = handleOrName?.trim() || "";
      const ch = await fetchChannelByHandle(apiKey, handle);
      if (!ch) return null;

      const uploads = ch.uploadsPlaylistId ? await fetchUploads(apiKey, ch.uploadsPlaylistId) : [];
      const videoIds = uploads.map((u) => u.videoId).filter(Boolean);
      const stats = videoIds.length ? await fetchVideoStats(apiKey, videoIds) : [];

      let analyticsByVideo = [];
      if (accessToken && ch.id) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 90);
        try {
          analyticsByVideo = await fetchVideoAnalytics(
            accessToken,
            ch.id,
            start.toISOString().slice(0, 10),
            end.toISOString().slice(0, 10)
          );
        } catch {
          analyticsByVideo = [];
        }
      }

      const posts = uploads.map((u) => {
        const s = stats.find((st) => st.id === u.videoId);
        const a = analyticsByVideo.find((av) => av.videoId === u.videoId);
        const views = a?.views ?? s?.views ?? 0;
        const likes = a?.likes ?? s?.likes ?? 0;
        const comments = a?.comments ?? s?.comments ?? 0;
        const shares = a?.shares ?? 0;
        const dur = s?.duration ?? 0;
        const avgDur = a?.averageViewDurationSeconds ?? 0;
        const sr = dur > 0 && avgDur >= 0 ? Math.max(0, Math.min(1, 1 - avgDur / dur)) : null;
        return {
          id: u.videoId,
          cap: u.title || s?.title || "(Untitled)",
          views,
          likes,
          cmts: comments,
          shares,
          plat: "yt",
          emoji: "▶️",
          ba: false,
          sr,
          publishedAt: u.publishedAt,
        };
      });

      posts.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      const avgV = posts.length ? Math.round(posts.reduce((sum, p) => sum + p.views, 0) / posts.length) : 0;
      const totalV = posts.reduce((sum, p) => sum + p.views, 0);
      const lastPost = posts[0];
      const lastStr = lastPost?.publishedAt ? formatTimeAgo(lastPost.publishedAt) : "—";

      const platformData = {
        handle: ch.title,
        followers: ch.subscribers,
        avgViews: avgV >= 1000 ? (avgV / 1000).toFixed(1) + "K" : String(avgV),
        status: "active",
        last: lastStr,
        channelId: ch.id,
      };

      let dailyViews = [];
      if (accessToken && ch.id) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 90);
        try {
          dailyViews = await fetchDailyViews(accessToken, ch.id, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
        } catch {}
      }

      const entry = {
        channel: ch,
        platform: platformData,
        posts,
        totalViews: totalV,
        dailyViews,
      };

      const keys = [ch.title, ch.handle, handle].filter(Boolean);
      setChannels((prev) => {
        const next = { ...prev };
        keys.forEach((k) => (next[k] = entry));
        return next;
      });
      setConnectedHandles((prev) => (prev.includes(handle) || prev.includes(ch.title) ? prev : [...prev, handle || ch.title]));
      return entry;
    },
    [apiKey, accessToken]
  );

  const getChannelData = useCallback(
    (handleOrName) => {
      return channels[handleOrName] || null;
    },
    [channels]
  );

  const value = {
    apiKey: !!apiKey,
    accessToken: !!accessToken,
    setAccessToken: setToken,
    fetchChannel,
    removeChannel,
    getChannelData,
    channels: Object.keys(channels).length,
    channelData: channels,
    connectedHandles,
  };

  return <YouTubeContext.Provider value={value}>{children}</YouTubeContext.Provider>;
}

export function useYouTubeContext() {
  const ctx = useContext(YouTubeContext);
  if (!ctx) throw new Error("useYouTubeContext must be used within YouTubeProvider");
  return ctx;
}

function formatTimeAgo(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 86400 * 2) return "1d ago";
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + "d ago";
  if (diff < 86400 * 30) return Math.floor(diff / (86400 * 7)) + "w ago";
  if (diff < 86400 * 365) return Math.floor(diff / (86400 * 30)) + "mo ago";
  return Math.floor(diff / (86400 * 365)) + "y ago";
}
