/**
 * Supabase database helpers for brands and channels.
 * Use these when wiring the app to Supabase (after credentials are set).
 */
import { supabase, isSupabaseConfigured } from "./supabase";

// ─── Brands ────────────────────────────────────────────────────────────────

/** Fetch brands with handles array (app-ready shape: { id, name, color, handles }[])
 * Also returns handleToYoutubeId: { [handle]: youtubeChannelId } to skip search API (saves 100 units) */
export async function fetchBrandsWithChannels() {
  if (!isSupabaseConfigured()) return [];
  const { data: brandsData, error: brandsErr } = await supabase
    .from("brands")
    .select("id, name, color")
    .order("created_at", { ascending: true });
  if (brandsErr) throw brandsErr;
  if (!brandsData?.length) return [];
  const { data: channelsData, error: channelsErr } = await supabase
    .from("brand_channels")
    .select("brand_id, channel_handle, youtube_channel_id");
  if (channelsErr) throw channelsErr;
  const byBrand = {};
  const handleToYoutubeId = {};
  (channelsData ?? []).forEach((row) => {
    if (!byBrand[row.brand_id]) byBrand[row.brand_id] = [];
    byBrand[row.brand_id].push(row.channel_handle);
    if (row.youtube_channel_id) handleToYoutubeId[row.channel_handle] = row.youtube_channel_id;
  });
  const brands = brandsData.map((b) => ({
    id: b.id,
    name: b.name,
    color: b.color ?? "#d63031",
    handles: byBrand[b.id] ?? [],
  }));
  return { brands, handleToYoutubeId };
}

export async function fetchBrands() {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase.from("brands").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createBrand({ name, color = "#d63031" }) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  const { data, error } = await supabase.from("brands").insert({ name, color }).select().single();
  if (error) throw error;
  return data;
}

export async function updateBrand(id, { name, color }) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (color !== undefined) updates.color = color;
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("brands").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteBrand(id) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  const { error } = await supabase.from("brands").delete().eq("id", id);
  if (error) throw error;
}

// ─── Brand Channels ────────────────────────────────────────────────────────

export async function fetchBrandChannels(brandId) {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from("brand_channels")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addChannelToBrand(brandId, channelHandle, platform = "youtube", youtubeChannelId = null) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("brand_channels")
    .insert({ brand_id: brandId, channel_handle: channelHandle, platform, youtube_channel_id: youtubeChannelId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeChannelFromBrand(brandId, channelHandle) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from("brand_channels")
    .delete()
    .eq("brand_id", brandId)
    .eq("channel_handle", channelHandle);
  if (error) throw error;
}

// ─── Channel cache ─────────────────────────────────────────────────────────
// Reduces YouTube API calls by caching full channel+posts snapshots
// Cache TTL: channel metadata 6h, full sync 2h (configurable)

export const CACHE_TTL_HOURS = { channel: 6, fullSync: 2 };

export async function getCachedChannel(channelHandle) {
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.from("channel_cache").select("*").eq("channel_handle", channelHandle).single();
  return data;
}

/** Check if cache is fresh for given TTL (hours). Returns cached full entry or null */
export function isCacheFresh(cached, ttlHours = CACHE_TTL_HOURS.fullSync) {
  if (!cached?.last_synced_at) return false;
  const cutoff = Date.now() - ttlHours * 60 * 60 * 1000;
  return new Date(cached.last_synced_at).getTime() > cutoff;
}

/** Parse full snapshot from raw_platform_json (channel, platform, posts, totalViews, dailyViews) */
export function parseCachedSnapshot(cached) {
  const snap = cached?.raw_platform_json;
  if (!snap?.channel) return null;
  return {
    channel: snap.channel,
    platform: snap.platform,
    posts: snap.posts ?? [],
    totalViews: snap.totalViews ?? 0,
    dailyViews: snap.dailyViews ?? [],
  };
}

export async function upsertChannelCache(channelHandle, {
  youtube_channel_id,
  subscribers,
  video_count,
  raw_platform_json,
  fullSnapshot, // { channel, platform, posts, totalViews, dailyViews } for cache-first loads
}) {
  if (!isSupabaseConfigured()) return;
  const payload = {
    channel_handle: channelHandle,
    youtube_channel_id,
    subscribers,
    video_count,
    raw_platform_json: fullSnapshot ?? raw_platform_json,
    last_synced_at: new Date().toISOString(),
  };
  await supabase.from("channel_cache").upsert(payload, { onConflict: "channel_handle" });
}
