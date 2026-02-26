/**
 * Supabase database helpers for brands and channels.
 * Use these when wiring the app to Supabase (after credentials are set).
 */
import { supabase, isSupabaseConfigured } from "./supabase";

// ─── Brands ────────────────────────────────────────────────────────────────

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

export async function getCachedChannel(channelHandle) {
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.from("channel_cache").select("*").eq("channel_handle", channelHandle).single();
  return data;
}

export async function upsertChannelCache(channelHandle, { youtube_channel_id, subscribers, video_count, raw_platform_json }) {
  if (!isSupabaseConfigured()) return;
  await supabase.from("channel_cache").upsert(
    {
      channel_handle: channelHandle,
      youtube_channel_id,
      subscribers,
      video_count,
      raw_platform_json,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "channel_handle" }
  );
}
