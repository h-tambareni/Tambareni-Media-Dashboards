// Daily sync – writes `daily_snapshots` (cumulative total_views) for the Daily Growth chart.
// Invoked by pg_cron (schedules are UTC — see supabase/migrations/*_daily_sync*.sql). Typical target
// is ~midnight US Eastern; confirm the active expression in Supabase (Database → Cron / `cron.job`).
// Invoke manually: GET/POST https://[project].supabase.co/functions/v1/daily-sync?secret=YOUR_CRON_SECRET
// Set CRON_SECRET in Supabase Edge Function secrets
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SC_BASE = "https://api.scrapecreators.com";
const IG_API = "https://graph.instagram.com/v25.0";
const cors = { "Access-Control-Allow-Origin": "*" };

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret") || (await req.json().catch(() => ({}))).secret;
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    if (cronSecret && secret !== cronSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const scKey = (Deno.env.get("SCRAPECREATORS_API_KEY") || "").trim();

    if (!scKey) {
      return Response.json({ error: "SCRAPECREATORS_API_KEY not set" }, { status: 500, headers: cors });
    }

    const today = new Date().toISOString().slice(0, 10);

    const { data: channelsRaw } = await supabase
      .from("brand_channels")
      .select("channel_handle, platform, instagram_access_token, instagram_user_id, active");
    // Never sync deactivated accounts (.or() alone can miss edge cases; inactive must never run).
    const channels = (channelsRaw || []).filter((r: { active?: unknown }) => isChannelRowActive(r.active));
    const unique = new Map<string, { handle: string; platform: string; instagramAccessToken?: string; instagramUserId?: string }>();
    (channels || []).forEach((r: any) => {
      const h = (r.channel_handle || "").trim().toLowerCase().replace(/^@/, "");
      const p = r.platform || "youtube";
      if (h) unique.set(`${h}::${p}`, {
        handle: h,
        platform: p,
        instagramAccessToken: (r.instagram_access_token || "").trim() || undefined,
        instagramUserId: (r.instagram_user_id || "").trim() || undefined,
      });
    });
    let igTokensRaw = "";
    const { data: igRow } = await supabase.from("cron_config").select("value").eq("key", "instagram_tokens").single();
    if (igRow?.value) igTokensRaw = String(igRow.value).trim();
    if (!igTokensRaw) igTokensRaw = (Deno.env.get("INSTAGRAM_TOKENS") || "").trim();
    const igTokenMap: Record<string, string> = {};
    igTokensRaw.split(",").forEach((pair) => {
      const sep = pair.indexOf(":");
      if (sep > 0) {
        const h = pair.slice(0, sep).trim().toLowerCase().replace(/^@/, "");
        const t = pair.slice(sep + 1).trim();
        if (h && t) igTokenMap[h] = t;
      }
    });

    const results: { key: string; ok: boolean; err?: string }[] = [];

    for (const { handle, platform, instagramAccessToken, instagramUserId } of unique.values()) {
      try {
        let totalViews = 0;
        let followers = 0;
        let videoCount = 0;

        if (platform === "instagram") {
          // Never use "first token in map" for a different handle — that wrote the SAME /me metrics under every row (wrong numbers + duplicates).
          const token = instagramAccessToken || igTokenMap[handle];
          let me: { id?: string; username?: string; followers_count?: number; media_count?: number; error?: { message?: string } } | null = null;
          if (token) {
            const meRes = await fetch(
              `${IG_API}/me?fields=id,username,followers_count,media_count&access_token=${token}`,
            );
            me = await meRes.json();
          }
          const tokenMatchesHandle =
            me &&
            !me.error &&
            (
              (instagramUserId && String(me.id) === String(instagramUserId)) ||
              (me.username || "").trim().toLowerCase().replace(/^@/, "") === handle
            );

          if (tokenMatchesHandle && me?.id) {
            // Must match instagram-fetch: first page of media, insights on first 25 items (same totalViews as dashboard KPI).
            followers = me.followers_count ?? 0;
            videoCount = me.media_count ?? 0;
            const userId = me.id;
            const mediaRes = await fetch(
              `${IG_API}/${userId}/media?fields=id,media_type&limit=50&access_token=${token}`,
            );
            const mediaData = await mediaRes.json();
            if (mediaData.error) throw new Error(mediaData.error.message);
            const mediaList = mediaData.data || [];
            for (const m of mediaList.slice(0, 25)) {
              const mt = (m.media_type || "").toUpperCase();
              const metrics =
                mt === "VIDEO" || mt === "REELS" ? "views,likes,comments" : "likes,comments";
              try {
                const insRes = await fetch(`${IG_API}/${m.id}/insights?metric=${metrics}&access_token=${token}`);
                const insData = await insRes.json();
                const byName: Record<string, number> = {};
                (insData.data || []).forEach((d: { name: string; values: { value: string }[] }) => {
                  byName[d.name] = parseInt(d.values?.[0]?.value || "0", 10);
                });
                totalViews += byName.views ?? 0;
              } catch {}
            }
          } else {
            const profRes = await fetch(`${SC_BASE}/v1/instagram/profile?handle=${encodeURIComponent(handle)}`, { headers: { "x-api-key": scKey } });
            const profData = await profRes.json();
            if (!profRes.ok) throw new Error(profData?.message || "API error");
            const user = profData?.data?.user || profData?.user || profData;
            const fb = user?.edge_followed_by?.count ?? user?.edge_followed_by ?? 0;
            const mc = user?.edge_owner_to_timeline_media?.count ?? user?.edge_owner_to_timeline_media ?? 0;
            followers = typeof fb === "number" ? fb : (fb?.count ?? 0);
            videoCount = typeof mc === "number" ? mc : (mc?.count ?? 0);
            let maxId: string | null = null;
            for (let p = 0; p < 30; p++) {
              const postsUrl = new URL(`${SC_BASE}/v2/instagram/user/posts`);
              postsUrl.searchParams.set("handle", handle);
              if (maxId) postsUrl.searchParams.set("next_max_id", maxId);
              const postsRes = await fetch(postsUrl.toString(), { headers: { "x-api-key": scKey } });
              const postsData = await postsRes.json();
              if (!postsRes.ok) break;
              const items = postsData?.items || postsData?.data || [];
              for (const it of items) {
                const b = it?.node || it;
                totalViews += b?.play_count ?? b?.ig_play_count ?? b?.video_view_count ?? 0;
              }
              if (!postsData?.more_available || !items.length) break;
              maxId = postsData?.next_max_id ?? postsData?.cursor ?? null;
              if (!maxId) break;
            }
          }
        } else {
          const path = platform === "tiktok" ? "/v1/tiktok/profile" : "/v1/youtube/channel";
          const params = platform === "tiktok" ? { handle } : { handle };
          const sp = new URLSearchParams(params).toString();
          const chRes = await fetch(`${SC_BASE}${path}?${sp}`, { headers: { "x-api-key": scKey } });
          const ch = await chRes.json();
          if (!chRes.ok) throw new Error(ch?.message || "API error");
          if (platform === "tiktok") {
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
              const chunk = vData.aweme_list || vData.videos || [];
              vlist.push(...chunk);
              const hasMore = vData.has_more === 1 || vData.has_more === true;
              const next = vData.max_cursor ?? vData.cursor;
              if (!hasMore || !chunk.length || next === ttcursor) break;
              ttcursor = next;
            }
            totalViews = vlist.reduce((sum: number, v: any) => sum + ((v.statistics?.play_count ?? v.stats?.play_count ?? v.play_count ?? 0) || 0), 0);
          } else {
            followers = ch.subscriberCount ?? 0;
            videoCount = ch.videoCount ?? 0;
            totalViews = ch.viewCount ?? 0;
          }
        }

        await supabase.from("daily_snapshots").upsert({
          channel_handle: handle,
          platform,
          snapshot_date: today,
          total_views: totalViews,
          followers,
          video_count: videoCount,
        }, { onConflict: "channel_handle,platform,snapshot_date" });
        results.push({ key: `${handle}::${platform}`, ok: true });
      } catch (e) {
        results.push({ key: `${handle}::${platform}`, ok: false, err: String(e?.message || e) });
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    return Response.json({ ok: true, date: today, synced: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results }, { headers: cors });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: cors });
  }
});
