/**
 * Supabase database helpers for brands, channels, cache, and daily snapshots.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

export const CK_SEP = "::";
const norm = (h) => (h || "").toString().trim().toLowerCase().replace(/^@/, "");
export const ck = (handle, platform) => `${norm(handle)}${CK_SEP}${(platform || "youtube")}`;
export const pk = (compositeKey) => {
  const i = (compositeKey || "").lastIndexOf(CK_SEP);
  if (i > 0) return { handle: compositeKey.slice(0, i), platform: compositeKey.slice(i + CK_SEP.length) };
  return { handle: compositeKey || "", platform: "youtube" };
};

// ─── Brands ────────────────────────────────────────────────────────────────

export async function fetchBrandsWithChannels() {
  if (!isSupabaseConfigured()) return { brands: [], channelMeta: {} };
  const { data: brandsData, error: brandsErr } = await supabase
    .from("brands")
    .select("id, name, color")
    .order("created_at", { ascending: true });
  if (brandsErr) throw brandsErr;
  if (!brandsData?.length) return { brands: [], channelMeta: {} };
  let channelsData;
  const { data: d1, error: e1 } = await supabase
    .from("brand_channels")
    .select("brand_id, channel_handle, platform, youtube_channel_id, active");
  if (e1) {
    const { data: d2, error: e2 } = await supabase
      .from("brand_channels")
      .select("brand_id, channel_handle, platform, youtube_channel_id");
    if (e2) throw e2;
    channelsData = d2;
  } else {
    channelsData = d1;
  }
  const byBrand = {};
  const channelMeta = {};
  (channelsData ?? []).forEach((row) => {
    const plat = row.platform || "youtube";
    const key = ck(row.channel_handle, plat);
    if (!byBrand[row.brand_id]) byBrand[row.brand_id] = [];
    byBrand[row.brand_id].push({ key, handle: row.channel_handle, platform: plat, active: row.active !== false });
    channelMeta[key] = {
      handle: row.channel_handle,
      platform: plat,
      youtubeChannelId: row.youtube_channel_id,
      active: row.active !== false,
    };
  });
  const brands = brandsData.map((b) => ({
    id: b.id,
    name: b.name,
    color: b.color ?? "#d63031",
    handles: (byBrand[b.id] ?? []).map(h => h.key),
    handleStatus: Object.fromEntries((byBrand[b.id] ?? []).map(h => [h.key, h.active])),
  }));
  return { brands, channelMeta };
}

export async function createBrand({ name, color = "#d63031" }) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  const { data, error } = await supabase.from("brands").insert({ name, color }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteBrand(id) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  const { error } = await supabase.from("brands").delete().eq("id", id);
  if (error) throw error;
}

// ─── Brand Channels ────────────────────────────────────────────────────────

export async function addChannelToBrand(brandId, channelHandle, platform = "youtube", youtubeChannelId = null) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  const h = norm(channelHandle) || channelHandle;
  const { data, error } = await supabase
    .from("brand_channels")
    .insert({ brand_id: brandId, channel_handle: h, platform, youtube_channel_id: youtubeChannelId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeChannelFromBrand(brandId, channelHandle, platform) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  const h = norm(channelHandle) || channelHandle;
  const handles = [...new Set([h, channelHandle].filter(Boolean))];
  let q = supabase.from("brand_channels").delete().eq("brand_id", brandId).in("channel_handle", handles);
  if (platform) q = q.eq("platform", platform);
  const { error } = await q;
  if (error) throw error;
}

export async function toggleChannelActive(brandId, channelHandle, platform, active) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  const h = norm(channelHandle) || channelHandle;
  const handles = [...new Set([h, channelHandle].filter(Boolean))];
  let q = supabase.from("brand_channels").update({ active }).eq("brand_id", brandId).in("channel_handle", handles);
  if (platform) q = q.eq("platform", platform);
  const { error } = await q;
  if (error) console.warn("toggleChannelActive failed (run migration 002):", error.message);
}

// ─── Channel cache ─────────────────────────────────────────────────────────

export const CACHE_TTL_HOURS = 12;

export async function getCachedChannel(channelHandle) {
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.from("channel_cache").select("*").eq("channel_handle", channelHandle).maybeSingle();
  return data;
}

/** Try composite key first, then legacy raw handle (normalized). Validates platform match for legacy. */
export async function getCachedChannelWithFallback(handle, platform) {
  if (!isSupabaseConfigured()) return null;
  const composite = ck(handle, platform);
  let { data: cached } = await supabase.from("channel_cache").select("*").eq("channel_handle", composite).maybeSingle();
  if (cached) return cached;
  const rawNorm = norm(handle);
  let { data: legacy } = await supabase.from("channel_cache").select("*").eq("channel_handle", rawNorm).maybeSingle();
  if (!legacy && rawNorm !== handle) {
    const { data: leg2 } = await supabase.from("channel_cache").select("*").eq("channel_handle", handle).maybeSingle();
    legacy = leg2;
  }
  if (!legacy?.raw_platform_json) return null;
  const plat = legacy.raw_platform_json?.platform?.platformType || legacy.raw_platform_json?.channel?.platform;
  return plat === platform ? legacy : null;
}

export function isCacheFresh(cached, ttlHours = CACHE_TTL_HOURS) {
  if (!cached?.last_synced_at) return false;
  return new Date(cached.last_synced_at).getTime() > Date.now() - ttlHours * 3600000;
}

export function parseCachedSnapshot(cached) {
  const snap = cached?.raw_platform_json;
  if (!snap?.channel) return null;
  return snap;
}

export async function upsertChannelCache(channelHandle, snapshot) {
  if (!isSupabaseConfigured()) return;
  await supabase.from("channel_cache").upsert({
    channel_handle: channelHandle,
    youtube_channel_id: snapshot.channel?.id || null,
    subscribers: snapshot.channel?.subscribers ?? 0,
    video_count: snapshot.channel?.videoCount ?? 0,
    raw_platform_json: snapshot,
    last_synced_at: new Date().toISOString(),
  }, { onConflict: "channel_handle" });
}

// ─── Daily snapshots (for views-over-time chart) ───────────────────────────

export async function upsertDailySnapshot(channelHandle, platform, { totalViews, followers, videoCount }) {
  if (!isSupabaseConfigured()) return;
  const today = new Date().toISOString().slice(0, 10);
  await supabase.from("daily_snapshots").upsert({
    channel_handle: channelHandle,
    platform,
    snapshot_date: today,
    total_views: totalViews ?? 0,
    followers: followers ?? 0,
    video_count: videoCount ?? 0,
  }, { onConflict: "channel_handle,platform,snapshot_date" });
}

export async function fetchDailySnapshots(channelHandle, platform, days = 90) {
  if (!isSupabaseConfigured()) return [];
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("daily_snapshots")
    .select("snapshot_date, total_views, followers")
    .eq("channel_handle", channelHandle)
    .eq("platform", platform)
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: true });
  return data ?? [];
}

export async function fetchLastSyncTime() {
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase
    .from("daily_snapshots")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data?.created_at ? new Date(data.created_at) : null;
}
