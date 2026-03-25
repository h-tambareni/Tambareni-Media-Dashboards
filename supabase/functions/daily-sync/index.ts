// Daily sync – writes `daily_snapshots` (cumulative total_views) for the Daily Growth chart.
//
// INSERT each run. Multiple rows per UTC calendar day are allowed (e.g. testing). The dashboard uses the
// latest row per day (`created_at`) when building charts.
//
// Invoked by pg_cron (schedules are UTC — see supabase/migrations/*_daily_sync*.sql).
// Invoke manually: GET/POST https://[project].supabase.co/functions/v1/daily-sync?secret=YOUR_CRON_SECRET
// Response body `results[]` has per-channel ok/err/warnings/total_views for visibility (check Edge Function logs + JSON).
//
// Set CRON_SECRET in Supabase Edge Function secrets
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SC_BASE = "https://api.scrapecreators.com";
const cors = { "Access-Control-Allow-Origin": "*" };

type ChannelResult = {
  key: string;
  ok: boolean;
  total_views?: number;
  /** UUID of the inserted row — use in SQL `where id = '…'` if the table UI count looks wrong. */
  snapshot_id?: string;
  err?: string;
  warnings?: string[];
};

/** Trim + lowercase so `youtube ` / ` tiktok` match DB intent; avoids duplicate groups + inserts that "disappear" from filters. */
function normPlatform(s: unknown): string {
  const t = String(s ?? "").trim().toLowerCase();
  return t || "youtube";
}

/** DB `active` must be treated as inactive only when explicitly false (boolean or legacy string). */
function isChannelRowActive(active: unknown): boolean {
  if (active === false) return false;
  if (active === true) return true;
  if (active === null || active === undefined) return true;
  if (typeof active === "string") {
    const s = active.trim().toLowerCase();
    if (s === "false" || s === "0" || s === "f") return false;
    if (s === "true" || s === "1" || s === "t") return true;
  }
  return true;
}

async function readBodySnippet(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t.slice(0, 500);
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(req.url);
    // Do not read JSON body on GET/HEAD — some gateways/runtimes behave badly; cron uses GET with ?secret=
    let secret = url.searchParams.get("secret") || "";
    if (!secret && req.method !== "GET" && req.method !== "HEAD") {
      try {
        const body = await req.json();
        secret = typeof body?.secret === "string" ? body.secret : "";
      } catch {
        /* empty body */
      }
    }
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    if (cronSecret && secret !== cronSecret) {
      console.warn("[daily-sync] 401 Unauthorized — wrong or missing ?secret= (must match CRON_SECRET)");
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) {
      console.error("[daily-sync] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set automatically in hosted Edge; check local invoke)");
      return Response.json(
        { error: "Server misconfigured: missing Supabase env" },
        { status: 500, headers: cors },
      );
    }
    const supabase = createClient(supabaseUrl, serviceKey);
    const scKey = (Deno.env.get("SCRAPECREATORS_API_KEY") || "").trim();

    if (!scKey) {
      console.error("[daily-sync] 500 SCRAPECREATORS_API_KEY missing in Edge Function secrets");
      return Response.json({ error: "SCRAPECREATORS_API_KEY not set" }, { status: 500, headers: cors });
    }

    const today = new Date().toISOString().slice(0, 10);
    console.log(`[daily-sync] run start date=${today} (UTC)`);

    const { data: channelsRaw } = await supabase
      .from("brand_channels")
      .select("channel_handle, platform, instagram_access_token, instagram_user_id, active");

    // Same handle+platform can appear on multiple brands. Do NOT let one "active" row overwrite an
    // inactive row — if ANY brand marks the account inactive, skip nightly snapshots for that key.
    type BcRow = {
      channel_handle: string;
      platform: string;
      instagram_access_token?: string | null;
      instagram_user_id?: string | null;
      active?: unknown;
    };
    /** Instagram: same account can be stored twice (e.g. `lovelogic.podcast` vs `lovelogicpodcast`). Group by instagram_user_id when present; else fold dots so duplicate spellings share one nightly job + inactive gate. */
    function groupKeyForRow(r: BcRow): string {
      const h = (r.channel_handle || "").trim().toLowerCase().replace(/^@/, "");
      const p = normPlatform(r.platform);
      if (!h) return "";
      if (p === "instagram") {
        const uid = (r.instagram_user_id || "").trim();
        if (uid) return `iguid:${uid}`;
        const fold = h.replace(/\./g, "");
        return `igfold:${fold}::instagram`;
      }
      return `${h}::${p}`;
    }

    const groups = new Map<string, BcRow[]>();
    for (const r of (channelsRaw || []) as BcRow[]) {
      const k = groupKeyForRow(r);
      if (!k) continue;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }

    const skippedInactive: string[] = [];
    const unique = new Map<string, { handle: string; platform: string }>();
    for (const [key, rows] of groups) {
      if (rows.some((r) => !isChannelRowActive(r.active))) {
        skippedInactive.push(key);
        continue;
      }
      const sorted = [...rows];
      const r = sorted[0];
      const h = (r.channel_handle || "").trim().toLowerCase().replace(/^@/, "");
      const p = normPlatform(r.platform);
      // Map key for loop must stay handle::platform (used in logs + JSON); uid-grouped rows share one insert handle.
      const mapKey = `${h}::${p}`;
      unique.set(mapKey, { handle: h, platform: p });
    }
    if (skippedInactive.length) {
      console.log(`[daily-sync] skipped (inactive on at least one brand_channels row): ${skippedInactive.length}`, skippedInactive.slice(0, 20));
    }
    console.log(`[daily-sync] channels to sync: ${unique.size}`);

    const results: ChannelResult[] = [];

    for (const { handle, platform } of unique.values()) {
      const platformNorm = normPlatform(platform);
      const key = `${handle}::${platformNorm}`;
      const warnings: string[] = [];
      try {
        let totalViews = 0;
        let followers = 0;
        let videoCount = 0;

        if (platformNorm === "instagram") {
          const profRes = await fetch(`${SC_BASE}/v1/instagram/profile?handle=${encodeURIComponent(handle)}`, { headers: { "x-api-key": scKey } });
          const profData = await profRes.json();
          if (!profRes.ok) throw new Error(profData?.message || `Instagram SC profile HTTP ${profRes.status}`);
          const user = profData?.data?.user || profData?.user || profData;
          const fb = user?.edge_followed_by?.count ?? user?.edge_followed_by ?? 0;
          const mc = user?.edge_owner_to_timeline_media?.count ?? user?.edge_owner_to_timeline_media ?? 0;
          followers = typeof fb === "number" ? fb : (fb?.count ?? 0);
          videoCount = typeof mc === "number" ? mc : (mc?.count ?? 0);
          let maxId: string | null = null;
          let page = 0;
          for (let p = 0; p < 30; p++) {
            const postsUrl = new URL(`${SC_BASE}/v2/instagram/user/posts`);
            postsUrl.searchParams.set("handle", handle);
            if (maxId) postsUrl.searchParams.set("next_max_id", maxId);
            const postsRes = await fetch(postsUrl.toString(), { headers: { "x-api-key": scKey } });
            const postsData = await postsRes.json();
            if (!postsRes.ok) {
              if (page === 0) {
                throw new Error(`Instagram SC posts HTTP ${postsRes.status}: ${postsData?.message || (await readBodySnippet(postsRes))}`);
              }
              warnings.push(`Instagram SC posts page ${page} failed HTTP ${postsRes.status}, using partial sum`);
              break;
            }
            const items = postsData?.items || postsData?.data || [];
            for (const it of items) {
              const b = it?.node || it;
              totalViews += b?.play_count ?? b?.ig_play_count ?? b?.video_view_count ?? 0;
            }
            if (!postsData?.more_available || !items.length) break;
            maxId = postsData?.next_max_id ?? postsData?.cursor ?? null;
            if (!maxId) break;
            page++;
          }
        } else {
          const path = platformNorm === "tiktok" ? "/v1/tiktok/profile" : "/v1/youtube/channel";
          const params = platformNorm === "tiktok" ? { handle } : { handle };
          const sp = new URLSearchParams(params).toString();
          const chRes = await fetch(`${SC_BASE}${path}?${sp}`, { headers: { "x-api-key": scKey } });
          const ch = await chRes.json();
          if (!chRes.ok) throw new Error(ch?.message || `SC channel HTTP ${chRes.status}`);
          if (platformNorm === "tiktok") {
            const s = ch.stats || {};
            followers = s.followerCount ?? 0;
            videoCount = s.videoCount ?? 0;
            const vlist: any[] = [];
            let ttcursor: string | null = null;
            for (let p = 0; p < 100; p++) {
              const vUrl = new URL(`${SC_BASE}/v3/tiktok/profile/videos`);
              vUrl.searchParams.set("handle", handle);
              vUrl.searchParams.set("sort_by", "latest");
              if (ttcursor) vUrl.searchParams.set("max_cursor", ttcursor);
              const vRes = await fetch(vUrl.toString(), { headers: { "x-api-key": scKey } });
              const vData = await vRes.json();
              if (!vRes.ok) {
                const detail = vData?.message || (await readBodySnippet(vRes));
                throw new Error(`TikTok videos page ${p} HTTP ${vRes.status}: ${detail}`);
              }
              const chunk = vData.aweme_list || vData.videos || [];
              vlist.push(...chunk);
              const hasMore = vData.has_more === 1 || vData.has_more === true;
              const next = vData.max_cursor ?? vData.cursor;
              if (!hasMore || !chunk.length || next === ttcursor) break;
              ttcursor = next;
            }
            totalViews = vlist.reduce((sum: number, v: any) => sum + ((v.statistics?.play_count ?? v.stats?.play_count ?? v.play_count ?? 0) || 0), 0);
            if (vlist.length === 0 && videoCount > 0) {
              throw new Error(
                `TikTok: profile reports videoCount=${videoCount} but /v3/tiktok/profile/videos returned 0 items — refusing to store total_views=0`,
              );
            }
            if (totalViews === 0 && videoCount === 0) {
              warnings.push("TikTok: total_views=0 (no videos / empty account)");
            }
          } else {
            followers = ch.subscriberCount ?? 0;
            videoCount = ch.videoCount ?? 0;
            totalViews = ch.viewCount ?? 0;
            if (totalViews === 0 && videoCount > 0) {
              warnings.push("YouTube: viewCount=0 but videoCount>0 (API oddity or new channel)");
            }
          }
        }

        const row = {
          channel_handle: handle,
          platform: platformNorm,
          snapshot_date: today,
          total_views: totalViews,
          followers,
          video_count: videoCount,
        };
        const { data: inserted, error: insErr } = await supabase.from("daily_snapshots").insert(row).select("id").single();
        if (insErr) throw new Error(`daily_snapshots insert: ${insErr.message}`);
        if (!inserted?.id) {
          throw new Error("daily_snapshots insert returned no row id (check RLS/triggers or PostgREST select)");
        }

        const entry: ChannelResult = { key, ok: true, total_views: totalViews, snapshot_id: inserted.id };
        if (warnings.length) entry.warnings = warnings;
        results.push(entry);
        if (warnings.length) console.warn(`[daily-sync] ${key} ok with warnings:`, warnings.join("; "));
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        console.error(`[daily-sync] ${key} FAILED:`, msg);
        results.push({ key, ok: false, err: msg });
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    const synced = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    console.log(`[daily-sync] date=${today} synced=${synced} failed=${failed}`);

    return Response.json(
      { ok: true, date: today, synced, failed, skipped_inactive: skippedInactive.length, skipped_inactive_keys: skippedInactive, results },
      { headers: cors },
    );
  } catch (e) {
    console.error("[daily-sync] fatal:", e);
    return Response.json({ error: String(e) }, { status: 500, headers: cors });
  }
});
