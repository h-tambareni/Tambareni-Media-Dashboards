import { useState, useEffect, useCallback } from "react";
import {
  fetchChannelByHandle,
  fetchChannelById,
  fetchUploads,
  fetchVideoStats,
  fetchDailyViews,
  fetchVideoAnalytics,
} from "../lib/youtube";

/**
 * Hook to fetch YouTube Data API (public) + Analytics API (OAuth) data for a channel
 * @param {Object} opts
 * @param {string} opts.handle - Channel handle (e.g. "Tambareni Careers" or "@tambarenicareers")
 * @param {string} opts.channelId - Optional; if known, skips handle lookup
 * @param {string} opts.apiKey - VITE_YOUTUBE_API_KEY for Data API
 * @param {string} opts.accessToken - OAuth token for Analytics API (optional)
 * @param {string} opts.startDate - YYYY-MM-DD for Analytics
 * @param {string} opts.endDate - YYYY-MM-DD for Analytics
 */
export function useYouTube(opts = {}) {
  const { handle, channelId, apiKey, accessToken, startDate, endDate } = opts;
  const [channel, setChannel] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [videoStats, setVideoStats] = useState([]);
  const [dailyViews, setDailyViews] = useState([]);
  const [analyticsByVideo, setAnalyticsByVideo] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadChannelAndVideos = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    setError(null);
    try {
      let ch = channelId ? await fetchChannelById(apiKey, channelId) : await fetchChannelByHandle(apiKey, handle);
      if (!ch) {
        setChannel(null);
        setUploads([]);
        setVideoStats([]);
        setLoading(false);
        return;
      }
      setChannel(ch);

      const uploadList = ch.uploadsPlaylistId
        ? await fetchUploads(apiKey, ch.uploadsPlaylistId)
        : [];
      setUploads(uploadList);

      const videoIds = uploadList.map((u) => u.videoId).filter(Boolean);
      const stats = videoIds.length ? await fetchVideoStats(apiKey, videoIds) : [];
      setVideoStats(stats);
    } catch (err) {
      setError(err.message);
      setChannel(null);
      setUploads([]);
      setVideoStats([]);
    } finally {
      setLoading(false);
    }
  }, [apiKey, channelId, handle]);

  const loadAnalytics = useCallback(async () => {
    if (!accessToken || !channel?.id || !startDate || !endDate) return;
    try {
      const [daily, byVideo] = await Promise.all([
        fetchDailyViews(accessToken, channel.id, startDate, endDate),
        fetchVideoAnalytics(accessToken, channel.id, startDate, endDate),
      ]);
      setDailyViews(daily);
      setAnalyticsByVideo(byVideo);
    } catch (err) {
      setError(err.message);
      setDailyViews([]);
      setAnalyticsByVideo([]);
    }
  }, [accessToken, channel?.id, startDate, endDate]);

  useEffect(() => {
    loadChannelAndVideos();
  }, [loadChannelAndVideos]);

  useEffect(() => {
    if (channel && accessToken && startDate && endDate) {
      loadAnalytics();
    } else {
      setDailyViews([]);
      setAnalyticsByVideo([]);
    }
  }, [channel, accessToken, startDate, endDate, loadAnalytics]);

  // Merge uploads + Data API stats + Analytics (shares, avgViewDuration for skip rate)
  const posts = uploads
    .map((u) => {
      const stats = videoStats.find((s) => s.id === u.videoId);
      const analytics = analyticsByVideo.find((a) => a.videoId === u.videoId);
      const views = analytics?.views ?? stats?.views ?? 0;
      const likes = analytics?.likes ?? stats?.likes ?? 0;
      const comments = analytics?.comments ?? stats?.comments ?? 0;
      const shares = analytics?.shares ?? 0;
      const durationSec = stats?.duration ?? 0;
      const avgDurSec = analytics?.averageViewDurationSeconds ?? 0;
      const sr = durationSec > 0 && avgDurSec >= 0 ? 1 - avgDurSec / durationSec : null;

      return {
        id: u.videoId,
        cap: u.title || stats?.title || "(Untitled)",
        views,
        likes,
        cmts: comments,
        shares,
        plat: "yt",
        emoji: "▶️",
        ba: false, // computed elsewhere from avg
        sr: sr !== null ? Math.max(0, Math.min(1, sr)) : null,
        publishedAt: u.publishedAt,
      };
    })
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const avgViews = posts.length ? Math.round(posts.reduce((s, p) => s + p.views, 0) / posts.length) : 0;
  const totalViews = posts.reduce((s, p) => s + p.views, 0);

  return {
    channel,
    uploads,
    videoStats,
    dailyViews,
    analyticsByVideo,
    posts,
    avgViews,
    totalViews,
    loading,
    error,
    refetch: loadChannelAndVideos,
  };
}
