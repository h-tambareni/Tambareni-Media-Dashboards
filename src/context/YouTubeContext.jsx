/**
 * Platform context — fetches channel + video data via ScrapeCreators API + Instagram Edge Functions.
 * Supports YouTube, TikTok, and Instagram. Caches snapshots in Supabase channel_cache.
 * Stores daily view totals for views-over-time chart.
 *
 * channelData keys use composite format: "handle::platform"
 */
import { createContext, useContext, useState, useCallback } from "react";
import { fetchYTChannel, fetchYTChannelVideos, fetchTTProfile, fetchTTProfileVideos } from "../lib/scrapeCreators";
import { fetchInstagramDirect, hasInstagramTokens } from "../lib/instagramApi";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  getCachedChannelWithFallback, isCacheFresh, parseCachedSnapshot,
  upsertChannelCache, deleteChannelCache, fetchDailySnapshots,
  updateBrandChannelYoutubeId, ck, pk,
} from "../lib/supabaseDb";

const PlatformContext = createContext(null);
const inFlight = new Map();

export function YouTubeProvider({ children }) {
  const apiKey = import.meta.env.VITE_SCRAPECREATORS_API_KEY || "";
  const [channels, setChannels] = useState({});
  const [connectedHandles, setConnectedHandles] = useState([]);

  const removeChannel = useCallback((compositeKey) => {
    setChannels((prev) => {
      const next = { ...prev };
      delete next[compositeKey];
      return next;
    });
    setConnectedHandles((prev) => prev.filter((h) => h !== compositeKey));
  }, []);

  const fetchChannel = useCallback(
    async (handleOrName, platformHint = "youtube", forceRefresh = false, forceFullFetch = false, opts = {}) => {
      const handle = (handleOrName?.trim() || "").replace(/^@/, "");
      const plat = platformHint || "youtube";
      const compositeKey = ck(handle, plat);
      const flightKey = `${compositeKey}:${forceRefresh}`;

      if (plat === "instagram") {
        const existing = inFlight.get(flightKey);
        if (existing) return existing;
        const doFetch = async () => {
          try {
            if (forceRefresh && isSupabaseConfigured()) {
              await deleteChannelCache(compositeKey);
              const rawNorm = (handle || "").toString().trim().toLowerCase().replace(/^@/, "");
              if (rawNorm !== compositeKey) await deleteChannelCache(rawNorm);
            }
            if (isSupabaseConfigured() && !forceRefresh) {
              const cached = await getCachedChannelWithFallback(handle, plat);
              if (isCacheFresh(cached)) {
                const snap = parseCachedSnapshot(cached);
                if (snap) {
                  setChannels((prev) => ({ ...prev, [compositeKey]: snap }));
                  setConnectedHandles((prev) => prev.includes(compositeKey) ? prev : [...prev, compositeKey]);
                  return snap;
                }
              }
            }
            const raw = await fetchInstagramDirect(handle);
            const posts = (raw.posts || []).map(p => ({ ...p, emoji: "📷" }));
            const lastPost = posts[0];
            const avgV = posts.length ? Math.round(posts.reduce((s, x) => s + (x.views || 0), 0) / posts.length) : 0;
            const entry = {
              channel: raw.channel,
              platform: {
                ...raw.platform,
                avgViews: avgV >= 1000 ? (avgV / 1000).toFixed(1) + "K" : String(avgV),
                status: "active",
                last: lastPost?.publishedAt ? formatTimeAgo(lastPost.publishedAt) : "—",
              },
              posts,
              totalViews: raw.totalViews ?? 0,
              dailyViews: raw.dailyViews || [],
            };
            setChannels((prev) => ({ ...prev, [compositeKey]: entry }));
            setConnectedHandles((prev) => prev.includes(compositeKey) ? prev : [...prev, compositeKey]);
            if (isSupabaseConfigured()) {
              upsertChannelCache(compositeKey, entry).catch(() => {});
              // Daily Growth chart uses only 11 PM ET snapshots from cron — no manual writes
            }
            return entry;
          } finally {
            inFlight.delete(flightKey);
          }
        };
        const p = doFetch();
        inFlight.set(flightKey, p);
        return p;
      }

      const scKey = apiKey ? apiKey : (isSupabaseConfigured() ? null : undefined);
      if (!scKey && scKey !== null) throw new Error("Configure Supabase or set VITE_SCRAPECREATORS_API_KEY");
      const existing = inFlight.get(flightKey);
      if (existing) return existing;

      const doFetch = async () => {
        try {
          const cacheKey = compositeKey;
          if (isSupabaseConfigured() && !forceRefresh) {
            const cached = await getCachedChannelWithFallback(handle, plat);
            if (isCacheFresh(cached)) {
              const snap = parseCachedSnapshot(cached);
              if (snap) {
                setChannels((prev) => ({ ...prev, [compositeKey]: snap }));
                setConnectedHandles((prev) => prev.includes(compositeKey) ? prev : [...prev, compositeKey]);
                return snap;
              }
            }
          }

          const cachedRow = isSupabaseConfigured() ? await getCachedChannelWithFallback(handle, plat) : null;
          const cachedSnap = cachedRow ? parseCachedSnapshot(cachedRow) : null;
          const cachedPosts = cachedSnap?.posts || [];
          const lastFullFetch = cachedSnap?.last_full_fetch_at ? new Date(cachedSnap.last_full_fetch_at) : null;
          const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
          const needsFullFetch = forceFullFetch || cachedPosts.length === 0 || !lastFullFetch || lastFullFetch.getTime() < weekAgo;

          let ch, videos;
          if (plat === "tiktok") {
            ch = await fetchTTProfile(scKey, handle);
            videos = await fetchTTProfileVideos(scKey, ch.handle || handle, { fullFetch: needsFullFetch, userId: ch.id });
          } else {
            const cachedChannelId = opts.youtubeChannelId || cachedRow?.youtube_channel_id || cachedSnap?.channel?.id;
            ch = await fetchYTChannel(scKey, handle, { channelId: cachedChannelId });
            videos = await fetchYTChannelVideos(scKey, handle, {
              fullFetch: needsFullFetch,
              channelId: ch.id,
              channelUrl: ch.channelUrl,
              canonicalHandle: ch.handle,
            });
          }

          const newPostsRaw = videos.map(v => ({
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
          const newPosts = (() => {
            const byId = new Map();
            newPostsRaw.forEach(p => {
              const existing = byId.get(p.id);
              if (!existing || (p.views || 0) > (existing.views || 0)) byId.set(p.id, p);
            });
            return Array.from(byId.values());
          })();

          let posts;
          if (needsFullFetch) {
            posts = newPosts;
          } else {
            const byId = new Map(cachedPosts.map(p => [p.id, { ...p }]));
            for (const p of newPosts) {
              byId.set(p.id, p);
            }
            posts = Array.from(byId.values());
          }

          posts.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
          const postViews = posts.reduce((s, p) => s + p.views, 0);
          const totalV = Math.max(ch.viewCount || 0, postViews);
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
            last_full_fetch_at: needsFullFetch ? new Date().toISOString() : (cachedSnap?.last_full_fetch_at || null),
          };

          setChannels((prev) => ({ ...prev, [compositeKey]: entry }));
          setConnectedHandles((prev) => prev.includes(compositeKey) ? prev : [...prev, compositeKey]);

          if (isSupabaseConfigured()) {
            upsertChannelCache(cacheKey, entry).catch(() => {});
            if (plat === "youtube" && ch?.id) updateBrandChannelYoutubeId(handle, plat, ch.id).catch(() => {});
            // Daily Growth chart uses only 11 PM ET snapshots from cron — no manual writes
          }
          return entry;
        } finally {
          inFlight.delete(flightKey);
        }
      };
      const p = doFetch();
      inFlight.set(flightKey, p);
      return p;
    },
    [apiKey]
  );

  const fetchChannelBatch = useCallback(
    async (items) => {
      if (!isSupabaseConfigured()) throw new Error("Supabase required for batch sync");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
      const res = await fetch(`${supabaseUrl}/functions/v1/sync-all-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
          "apikey": anonKey,
        },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Batch sync failed: ${res.status}`);
      const results = data.results || [];
      const successes = results.filter((r) => r.ok && r.entry);
      const withDaily = await Promise.all(
        successes.map(async (r) => {
          const key = r.key;
          let entry = r.entry;
          if (isSupabaseConfigured()) {
            const { handle, platform } = pk(key);
            const dailyRows = await fetchDailySnapshots(handle, platform);
            entry = {
              ...entry,
              dailyViews: dailyRows.map((row) => ({
                d: formatChartDate(row.snapshot_date),
                raw: row.snapshot_date,
                views: row.total_views,
              })),
            };
          }
          return { key, entry };
        })
      );
      setChannels((prev) => {
        const next = { ...prev };
        for (const { key, entry } of withDaily) next[key] = entry;
        return next;
      });
      setConnectedHandles((prev) => {
        const added = withDaily.map((x) => x.key).filter((k) => !prev.includes(k));
        return added.length ? [...prev, ...added] : prev;
      });
      for (const { key, entry } of withDaily) {
        upsertChannelCache(key, entry).catch(() => {});
        if (entry.channel?.platform === "youtube" && entry.channel?.id) {
          const { handle, platform } = pk(key);
          updateBrandChannelYoutubeId(handle, platform, entry.channel.id).catch(() => {});
        }
      }
      return results;
    },
    []
  );

  const value = {
    apiKey: !!apiKey || isSupabaseConfigured(),
    instagramConfigured: hasInstagramTokens(),
    fetchChannel,
    fetchChannelBatch,
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
