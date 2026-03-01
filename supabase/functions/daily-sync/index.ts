// Daily sync – runs at 11:59 PM to capture snapshots for the Daily Growth chart
// Invoke via cron: GET/POST https://[project].supabase.co/functions/v1/daily-sync?secret=YOUR_CRON_SECRET
// Set CRON_SECRET in Supabase Edge Function secrets
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SC_BASE = "https://api.scrapecreators.com";
const IG_API = "https://graph.instagram.com/v25.0";
const cors = { "Access-Control-Allow-Origin": "*" };

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

    // Prefer cron_config (DB) over INSTAGRAM_TOKENS env – DB wins so you can fix tokens without redeploying
    let igTokensRaw = "";
    const { data: igRow } = await supabase.from("cron_config").select("value").eq("key", "instagram_tokens").single();
    if (igRow?.value) igTokensRaw = String(igRow.value).trim();
    if (!igTokensRaw) igTokensRaw = (Deno.env.get("INSTAGRAM_TOKENS") || "").trim();

    if (!scKey) {
      return Response.json({ error: "SCRAPECREATORS_API_KEY not set" }, { status: 500, headers: cors });
    }

    const today = new Date().toISOString().slice(0, 10);

    const { data: channels } = await supabase
      .from("brand_channels")
      .select("channel_handle, platform")
      .or("active.is.null,active.eq.true");
    const unique = new Map<string, { handle: string; platform: string }>();
    (channels || []).forEach((r) => {
      const h = (r.channel_handle || "").trim().toLowerCase().replace(/^@/, "");
      const p = r.platform || "youtube";
      if (h) unique.set(`${h}::${p}`, { handle: h, platform: p });
    });

    const igMap: Record<string, string> = {};
    igTokensRaw.split(",").forEach((pair) => {
      const sep = pair.indexOf(":");
      if (sep > 0) {
        const handle = pair.slice(0, sep).trim().toLowerCase().replace(/^@/, "");
        const token = pair.slice(sep + 1).trim();
        if (handle && token) igMap[handle] = token;
      }
    });

    const results: { key: string; ok: boolean; err?: string }[] = [];

    for (const { handle, platform } of unique.values()) {
      try {
        let totalViews = 0;
        let followers = 0;
        let videoCount = 0;

        if (platform === "instagram") {
          const token = igMap[handle] || Object.values(igMap)[0];
          if (!token) { results.push({ key: `${handle}::instagram`, ok: false, err: "No token" }); continue; }
          const meRes = await fetch(`${IG_API}/me?fields=id,username,followers_count,media_count&access_token=${token}`);
          const me = await meRes.json();
          if (me.error) throw new Error(me.error.message);
          followers = me.followers_count ?? 0;
          videoCount = me.media_count ?? 0;
          const mediaList: { id: string; media_type: string }[] = [];
          let nextUrl: string | null = `${IG_API}/${me.id}/media?fields=id,media_type&limit=50&access_token=${token}`;
          while (nextUrl) {
            const mediaRes = await fetch(nextUrl);
            const mediaData = await mediaRes.json();
            if (mediaData.error) throw new Error(mediaData.error.message);
            const chunk = mediaData.data || [];
            mediaList.push(...chunk);
            nextUrl = mediaData.paging?.next || null;
          }
          for (const m of mediaList) {
            if ((m.media_type || "").toUpperCase() === "VIDEO" || (m.media_type || "").toUpperCase() === "REELS") {
              try {
                const ir = await fetch(`${IG_API}/${m.id}/insights?metric=views&access_token=${token}`);
                const ij = await ir.json();
                const v = ij?.data?.[0]?.values?.[0]?.value ?? ij?.data?.[0]?.total_value?.value;
                if (typeof v === "number") totalViews += v;
              } catch {}
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
