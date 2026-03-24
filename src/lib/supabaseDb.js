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
    .select("brand_id, channel_handle, platform, youtube_channel_id, active, instagram_access_token");
  if (e1) {
    const { data: d2, error: e2 } = await supabase
      .from("brand_channels")
      .select("brand_id, channel_handle, platform, youtube_channel_id, instagram_access_token");
    if (e2) throw e2;
    channelsData = d2;
  } else {
    channelsData = d1;
  }
  const byBrand = {};
  const channelMeta = {};
  const ytKeysNeedingCache = [];
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
      hasLegacyInstagramToken: plat === "instagram" && !!(row.instagram_access_token || "").trim(),
    };
    if (plat === "youtube" && !row.youtube_channel_id) ytKeysNeedingCache.push(key);
  });
  // Enrich YouTube channelMeta with youtube_channel_id from channel_cache when brand_channels lacks it
  if (ytKeysNeedingCache.length) {
    const cacheHandles = [...new Set([...ytKeysNeedingCache, ...ytKeysNeedingCache.map(k => pk(k).handle)])];
    const { data: cacheRows } = await supabase
      .from("channel_cache")
      .select("channel_handle, youtube_channel_id")
      .in("channel_handle", cacheHandles)
      .not("youtube_channel_id", "is", null);
    (cacheRows ?? []).forEach((r) => {
      const key = ytKeysNeedingCache.find(k => k === r.channel_handle || pk(k).handle === r.channel_handle);
      if (key && channelMeta[key]) channelMeta[key].youtubeChannelId = r.youtube_channel_id;
    });
  }
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
  const h = norm(channelHandle);
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

/** Same as daily-sync igfold: Instagram handles may differ only by dots (`lovelogic.podcast` vs `lovelogicpodcast`). */
export function igFoldHandle(h) {
  return norm(h).replace(/\./g, "");
}

export async function toggleChannelActive(brandId, channelHandle, platform, active) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  const plat = platform || "youtube";
  const nh = norm(channelHandle);
  const trimmed = (channelHandle || "").trim().replace(/^@/, "");
  // Match DB row whether it was stored lowercased or legacy casing; avoid .ilike() — _ and % are LIKE wildcards.
  let candidates = [...new Set([nh, trimmed, trimmed.toLowerCase()].filter(Boolean))];
  if (plat === "instagram") {
    const fold = igFoldHandle(channelHandle);
    if (fold && !candidates.includes(fold)) candidates.push(fold);
  }

  let rows = null;
  const { data: byHandle, error: qErr } = await supabase
    .from("brand_channels")
    .select("id, instagram_user_id, channel_handle")
    .eq("brand_id", brandId)
    .eq("platform", plat)
    .in("channel_handle", candidates);
  if (qErr) throw new Error(`Failed to update account status: ${qErr.message}`);
  rows = byHandle;

  if (plat === "instagram" && (!rows || rows.length === 0)) {
    const { data: allIg, error: allErr } = await supabase
      .from("brand_channels")
      .select("id, instagram_user_id, channel_handle")
      .eq("brand_id", brandId)
      .eq("platform", "instagram");
    if (allErr) throw new Error(`Failed to update account status: ${allErr.message}`);
    const t = igFoldHandle(channelHandle);
    rows = (allIg || []).filter((r) => igFoldHandle(r.channel_handle) === t);
  }

  if (!rows?.length) {
    throw new Error(
      "No matching account row was updated. Try removing and re-adding the account, or check channel handle in the database.",
    );
  }

  const ids = new Set(rows.map((r) => r.id));
  const uids = [...new Set(rows.map((r) => r.instagram_user_id).filter(Boolean))];
  if (plat === "instagram" && uids.length) {
    const { data: sib, error: sErr } = await supabase
      .from("brand_channels")
      .select("id")
      .eq("brand_id", brandId)
      .eq("platform", "instagram")
      .in("instagram_user_id", uids);
    if (sErr) throw new Error(`Failed to update account status: ${sErr.message}`);
    (sib || []).forEach((r) => ids.add(r.id));
  }

  const { data: updated, error } = await supabase
    .from("brand_channels")
    .update({ active })
    .in("id", [...ids])
    .select("id");
  if (error) throw new Error(`Failed to update account status: ${error.message}`);
  if (!updated?.length) {
    throw new Error(
      "No matching account row was updated. Try removing and re-adding the account, or check channel handle in the database.",
    );
  }
}

export async function updateBrandChannelYoutubeId(channelHandle, platform, youtubeChannelId) {
  if (!isSupabaseConfigured() || platform !== "youtube" || !youtubeChannelId) return;
  const h = norm(channelHandle) || channelHandle;
  const candidates = [...new Set([h, channelHandle].filter(Boolean))];
  await supabase.from("brand_channels").update({ youtube_channel_id: youtubeChannelId }).in("channel_handle", candidates).eq("platform", "youtube");
}

// ─── Channel cache ─────────────────────────────────────────────────────────

export const CACHE_TTL_HOURS = 12;

export async function getCachedChannel(channelHandle) {
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.from("channel_cache").select("*").eq("channel_handle", channelHandle).maybeSingle();
  return data;
}

/** Columns needed for cache hydration + freshness; avoids pulling huge JSON twice. */
const CACHE_SELECT = "channel_handle, raw_platform_json, last_synced_at, youtube_channel_id";

function platformMatchesRow(platform, row) {
  const j = row?.raw_platform_json;
  if (!j) return false;
  const plat = j?.platform?.platformType || j?.channel?.platform;
  return plat === platform;
}

/** Try composite key first, then legacy raw handle (normalized). Instagram: a few targeted keys only (never full-table scan). */
export async function getCachedChannelWithFallback(handle, platform) {
  if (!isSupabaseConfigured()) return null;
  const composite = ck(handle, platform);
  const tryKey = async (key) => {
    if (!key) return null;
    const { data } = await supabase.from("channel_cache").select(CACHE_SELECT).eq("channel_handle", key).maybeSingle();
    return data;
  };

  let cached = await tryKey(composite);
  if (cached?.raw_platform_json) return cached;

  const rawNorm = norm(handle);
  cached = await tryKey(rawNorm);
  if (cached?.raw_platform_json && platformMatchesRow(platform, cached)) return cached;

  const trimmed = (handle || "").trim().replace(/^@/, "");
  if (trimmed && trimmed !== rawNorm) {
    cached = await tryKey(trimmed);
    if (cached?.raw_platform_json && platformMatchesRow(platform, cached)) return cached;
  }

  if (platform === "instagram") {
    const dotless = norm(handle.replace(/\./g, ""));
    const variantKeys = [...new Set([
      `${dotless}::instagram`,
      `${norm(trimmed.replace(/\./g, ""))}::instagram`,
    ])].filter((k) => k && k !== composite);

    for (const k of variantKeys) {
      cached = await tryKey(k);
      if (cached?.raw_platform_json && platformMatchesRow("instagram", cached)) return cached;
    }
  }
  return null;
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

export async function deleteChannelCache(channelHandle) {
  if (!isSupabaseConfigured()) return;
  await supabase.from("channel_cache").delete().eq("channel_handle", channelHandle);
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

/** Legacy helper — not used by the web app. Inserts another row for today (multiple per day allowed; charts use latest by `created_at`). */
export async function upsertDailySnapshot(channelHandle, platform, { totalViews, followers, videoCount }) {
  if (!isSupabaseConfigured()) return;
  const today = new Date().toISOString().slice(0, 10);
  const h = norm(channelHandle);
  await supabase.from("daily_snapshots").insert({
    channel_handle: h,
    platform,
    snapshot_date: today,
    total_views: totalViews ?? 0,
    followers: followers ?? 0,
    video_count: videoCount ?? 0,
  });
}

/**
 * When multiple snapshot rows exist for the same calendar day (e.g. cron re-runs while testing),
 * keep the one with the greatest created_at (ties: last in sort order).
 */
export function pickLatestSnapshotsPerDay(rows) {
  if (!rows?.length) return [];
  const byDate = new Map();
  for (const r of rows) {
    const d = r.snapshot_date;
    if (d == null) continue;
    const key = typeof d === "string" ? d.slice(0, 10) : d;
    const prev = byDate.get(key);
    const t = r.created_at ? new Date(r.created_at).getTime() : 0;
    const pt = prev?.created_at ? new Date(prev.created_at).getTime() : -1;
    const better =
      !prev ||
      t > pt ||
      (t === pt && String(r.id || "") >= String(prev.id || ""));
    if (better) byDate.set(key, r);
  }
  return [...byDate.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map(([, v]) => v);
}

/**
 * Snapshot history for charting: one effective row per calendar day — if multiple rows exist
 * for the same day (testing re-runs), uses the latest by `created_at`.
 */
export async function fetchDailySnapshots(channelHandle, platform, days = null) {
  if (!isSupabaseConfigured()) return [];
  const h = norm(channelHandle);
  let q = supabase
    .from("daily_snapshots")
    .select("id, snapshot_date, total_views, followers, created_at")
    .eq("channel_handle", h)
    .eq("platform", platform);
  if (days != null && Number(days) > 0) {
    const since = new Date(Date.now() - Number(days) * 86400000).toISOString().slice(0, 10);
    q = q.gte("snapshot_date", since);
  }
  const { data } = await q
    .order("snapshot_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(50000);
  return pickLatestSnapshotsPerDay(data ?? []);
}

/** Stores when Sync All was last run (shared across devices). */
export async function upsertLastManualSync() {
  if (!isSupabaseConfigured()) return;
  const now = new Date().toISOString();
  await supabase.from("cron_config").upsert({ key: "last_manual_sync", value: now }, { onConflict: "key" });
}

/**
 * Latest activity that refreshed stored data — max of:
 * - `daily_snapshots` (nightly cron inserts)
 * - `cron_config.last_manual_sync` (password Sync All)
 * - `channel_cache.last_synced_at` (any account sync: single-channel fetch or batch)
 */
export async function fetchLastSyncTime() {
  if (!isSupabaseConfigured()) return null;
  const [snapRes, manualRes, cacheRes] = await Promise.all([
    supabase.from("daily_snapshots").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("cron_config").select("value").eq("key", "last_manual_sync").maybeSingle(),
    supabase.from("channel_cache").select("last_synced_at").order("last_synced_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const snapTime = snapRes.data?.created_at ? new Date(snapRes.data.created_at) : null;
  const manualTime = manualRes.data?.value ? new Date(manualRes.data.value) : null;
  const cacheTime = cacheRes.data?.last_synced_at ? new Date(cacheRes.data.last_synced_at) : null;
  const times = [snapTime, manualTime, cacheTime].filter(Boolean);
  if (!times.length) return null;
  return new Date(Math.max(...times.map((d) => d.getTime())));
}
