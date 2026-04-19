/**
 * Platform context — fetches channel + video data via ScrapeCreators API (all platforms).
 * Supports YouTube, TikTok, and Instagram. Caches snapshots in Supabase channel_cache.
 * Daily Growth reads `daily_snapshots` from Supabase (written only by the nightly `daily-sync` cron — not on app sync).
 *
 * channelData keys use composite format: "handle::platform"
 */
import { createContext, useContext, useState, useCallback, useRef } from "react";
import { fetchYTChannel, fetchYTChannelVideos, fetchTTProfile, fetchTTProfileVideos, fetchIGProfile, fetchIGPosts } from "../lib/scrapeCreators";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  getCachedChannelWithFallback, isCacheFresh, parseCachedSnapshot,
  upsertChannelCache, upsertChannelCacheBatch, deleteChannelCache, fetchDailySnapshots,
  updateBrandChannelYoutubeId, ck, pk,
} from "../lib/supabaseDb";

const PlatformContext = createContext(null);
const inFlight = new Map();

function notifyChannelCacheUpdated() {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cameleo-cache-updated"));
    }
  } catch {}
}

export function YouTubeProvider({ children }) {
  const apiKey = import.meta.env.VITE_SCRAPECREATORS_API_KEY || "";
  const [channels, setChannels] = useState({});
  const [connectedHandles, setConnectedHandles] = useState([]);
  /** Set to true during Sync All to block background fetchChannel calls from overwriting fresh batch data. */
  const isBatchSyncingRef = useRef(false);

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

      const scKey = apiKey ? apiKey : (isSupabaseConfigured() ? null : undefined);
      const existing = inFlight.get(flightKey);
      if (existing) return existing;

      const doFetch = async () => {
        try {
          // One cache read per channel. Stale-while-revalidate: paint last snapshot immediately, then refresh.
          let cached = null;
          let cachedSnap = null;
          if (isSupabaseConfigured()) {
            cached = await getCachedChannelWithFallback(handle, plat);
            cachedSnap = cached ? parseCachedSnapshot(cached) : null;
            if (!forceRefresh && cachedSnap) {
              // Don't paint stale cache on top of fresh batch-sync data
              if (!isBatchSyncingRef.current) setChannels((prev) => ({ ...prev, [compositeKey]: cachedSnap }));
              setConnectedHandles((prev) => (prev.includes(compositeKey) ? prev : [...prev, compositeKey]));
              const postsEarly = cachedSnap?.posts || [];
              const declaredEarly =
                plat === "instagram" || plat === "tiktok" || plat === "youtube"
                  ? (cachedSnap?.channel?.videoCount ?? 0)
                  : 0;
              /** Even if last_synced is “fresh”, refetch when catalog is clearly thinner than profile count (legacy partial sync). */
              const mustBackfillCatalog =
                declaredEarly > 0 &&
                postsEarly.length > 0 &&
                postsEarly.length < declaredEarly &&
                postsEarly.length <= 150;
              if (isCacheFresh(cached) && !mustBackfillCatalog) return cachedSnap;
            }
          }

          const cachedRow = cached;
          const cachedPosts = cachedSnap?.posts || [];
          const lastFullFetch = cachedSnap?.last_full_fetch_at ? new Date(cachedSnap.last_full_fetch_at) : null;
          const weekAgo = Date.now() - 2 * 24 * 3600 * 1000; // full re-fetch if last full fetch >2 days ago
          /** Profile media/video count vs cached rows — refetch full catalog if we only have a thin slice (e.g. legacy 1-page cache). */
          const declaredMediaCount =
            plat === "instagram" || plat === "tiktok" || plat === "youtube"
              ? (cachedSnap?.channel?.videoCount ?? 0)
              : 0;
          const catalogLikelyIncomplete =
            declaredMediaCount > 0 &&
            cachedPosts.length > 0 &&
            cachedPosts.length < declaredMediaCount &&
            cachedPosts.length <= 150;
          const needsFullFetch =
            forceFullFetch ||
            cachedPosts.length === 0 ||
            !lastFullFetch ||
            lastFullFetch.getTime() < weekAgo ||
            catalogLikelyIncomplete;

          let entry;

          // Kick off dailySnapshots fetch early — it only needs handle+plat (no API result).
          // We await it later when building the final entry, so it runs in parallel with profile+videos.
          const dailyViewsPromise = isSupabaseConfigured()
            ? fetchDailySnapshots(handle, plat).then(rows => rows.map(row => ({
                d: formatChartDate(row.snapshot_date),
                raw: row.snapshot_date,
                views: row.total_views,
                followers: row.followers ?? 0,
              }))).catch(() => [])
            : Promise.resolve([]);

          if (plat === "instagram") {
            if (!scKey && scKey !== null) throw new Error("Configure Supabase or set VITE_SCRAPECREATORS_API_KEY");
            const ch = await fetchIGProfile(scKey, handle);
            const videos = await fetchIGPosts(scKey, ch.handle || handle, {
              fullFetch: needsFullFetch,
              userId: ch.id ?? null,
            });
            entry = buildEntryFromVideos(ch, videos, handle, plat, cachedSnap, needsFullFetch);
            if (entry) {
              const dailyViews = await dailyViewsPromise;
              if (dailyViews.length) entry = { ...entry, dailyViews };
              setChannels((prev) => ({ ...prev, [compositeKey]: entry }));
              setConnectedHandles((prev) => prev.includes(compositeKey) ? prev : [...prev, compositeKey]);
              if (isSupabaseConfigured()) {
                upsertChannelCache(compositeKey, entry).then(() => notifyChannelCacheUpdated()).catch((e) => console.error("[fetchChannel:ig] cache write failed", compositeKey, e?.message));
              }
              return entry;
            }
          }

          if (!scKey && scKey !== null) throw new Error("Configure Supabase or set VITE_SCRAPECREATORS_API_KEY");
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
          // For partial fetches: never let totalViews decrease — older cached posts have stale counts.
          // A partial fetch can raise or hold the value but never lower it.
          const cachedTotal = needsFullFetch ? 0 : (cachedSnap?.totalViews ?? 0);
          const totalV = Math.max(ch.viewCount ?? 0, postViews, cachedTotal);
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

          const pendingForSnapshot = {
            channel: ch,
            platform: platformData,
            posts,
            totalViews: totalV,
          };
          // dailyViewsPromise was kicked off earlier in parallel with profile+videos.
          const dailyViews = await dailyViewsPromise;

          entry = {
            ...pendingForSnapshot,
            dailyViews,
            last_full_fetch_at: needsFullFetch ? new Date().toISOString() : (cachedSnap?.last_full_fetch_at || null),
          };

          // Don't overwrite state if a Sync All batch completed while this background fetch was in-flight.
          if (!isBatchSyncingRef.current || forceRefresh) {
            setChannels((prev) => ({ ...prev, [compositeKey]: entry }));
            setConnectedHandles((prev) => prev.includes(compositeKey) ? prev : [...prev, compositeKey]);
          }

          if (isSupabaseConfigured()) {
            upsertChannelCache(compositeKey, entry).then(() => notifyChannelCacheUpdated()).catch((e) => console.error("[fetchChannel] cache write failed", compositeKey, e?.message));
            if (plat === "youtube" && ch?.id) updateBrandChannelYoutubeId(handle, plat, ch.id).catch(() => {});
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
      isBatchSyncingRef.current = true;
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
                followers: row.followers ?? 0,
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
      // One fetchBrandChannelsRows call shared across all upserts (avoids N+1 queries).
      await upsertChannelCacheBatch(withDaily, { onNotify: notifyChannelCacheUpdated });
      for (const { key, entry } of withDaily) {
        if (entry.channel?.platform === "youtube" && entry.channel?.id) {
          const { handle, platform } = pk(key);
          updateBrandChannelYoutubeId(handle, platform, entry.channel.id).catch(() => {});
        }
      }
      isBatchSyncingRef.current = false;
      return results;
    },
    []
  );

  const value = {
    apiKey: !!apiKey || isSupabaseConfigured(),
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

function buildEntryFromVideos(ch, videos, handle, plat, cachedSnap, needsFullFetch) {
  const newPostsRaw = videos.map(v => ({
    id: v.id,
    cap: v.title || "(Untitled)",
    views: v.views ?? 0,
    likes: v.likes ?? 0,
    cmts: v.comments ?? 0,
    shares: v.shares ?? 0,
    plat: "ig",
    emoji: "📷",
    thumbnail: v.thumbnail,
    publishedAt: v.publishedAt,
  }));
  // Deduplicate new posts (keep highest views per id)
  const newById = new Map();
  newPostsRaw.forEach(p => {
    const existing = newById.get(p.id);
    if (!existing || (p.views || 0) > (existing.views || 0)) newById.set(p.id, p);
  });
  const newPosts = Array.from(newById.values());

  // Merge with cached posts for partial fetches (same logic as TT/YT)
  let posts;
  if (needsFullFetch) {
    posts = newPosts;
  } else {
    const cachedPosts = cachedSnap?.posts || [];
    const byId = new Map(cachedPosts.map(p => [p.id, { ...p }]));
    for (const p of newPosts) byId.set(p.id, p); // new data wins on conflict
    posts = Array.from(byId.values());
  }

  posts.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  const postViews = posts.reduce((s, p) => s + p.views, 0);
  // For partial fetches: never let totalViews decrease vs cached value
  const cachedTotal = needsFullFetch ? 0 : (cachedSnap?.totalViews ?? 0);
  const totalV = Math.max(ch.viewCount ?? 0, postViews, cachedTotal);
  const avgV = posts.length ? Math.round(postViews / posts.length) : 0;
  const lastPost = posts[0];
  const thumb = ch.thumbnail || (posts[0]?.thumbnail) || null;
  return {
    channel: { ...ch, thumbnail: ch.thumbnail || thumb },
    platform: {
      handle: ch.handle || handle,
      displayName: ch.title || ch.handle || handle,
      followers: ch.subscribers ?? 0,
      avgViews: avgV >= 1000 ? (avgV / 1000).toFixed(1) + "K" : String(avgV),
      status: "active",
      last: lastPost?.publishedAt ? formatTimeAgo(lastPost.publishedAt) : "—",
      channelId: ch.id,
      thumbnail: thumb,
      platformType: plat,
    },
    posts,
    totalViews: totalV,
    dailyViews: [],
    last_full_fetch_at: needsFullFetch ? new Date().toISOString() : (cachedSnap?.last_full_fetch_at || null),
  };
}
