// Fetches Instagram profile, media, and insights using stored token. Returns normalized channel data.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const IG_API = "https://graph.instagram.com/v25.0";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { compositeKey } = await req.json();
    if (!compositeKey || !compositeKey.includes("::")) {
      return Response.json({ error: "invalid compositeKey" }, { status: 400, headers: { ...cors } });
    }
    const [handle, platform] = compositeKey.split("::");
    if (platform !== "instagram") {
      return Response.json({ error: "not instagram" }, { status: 400, headers: { ...cors } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: row, error: rowErr } = await supabase
      .from("brand_channels")
      .select("instagram_access_token, access_token_expires_at")
      .eq("channel_handle", handle)
      .eq("platform", "instagram")
      .maybeSingle();

    if (rowErr || !row?.instagram_access_token) {
      return Response.json(
        { error: "Instagram account not connected or token missing" },
        { status: 404, headers: { ...cors } }
      );
    }

    let token = row.instagram_access_token;
    const expiresAt = row.access_token_expires_at ? new Date(row.access_token_expires_at) : null;
    const oneDayFromNow = Date.now() + 86400000;
    if (expiresAt && expiresAt.getTime() < oneDayFromNow) {
      // Refresh token
      const refreshRes = await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`
      );
      const refreshData = await refreshRes.json();
      if (refreshData.access_token) {
        token = refreshData.access_token;
        const newExp = new Date(Date.now() + (refreshData.expires_in || 5184000) * 1000).toISOString();
        await supabase
          .from("brand_channels")
          .update({ instagram_access_token: token, access_token_expires_at: newExp })
          .eq("channel_handle", handle)
          .eq("platform", "instagram");
      }
    }

    // Fetch profile
    const meRes = await fetch(
      `${IG_API}/me?fields=id,username,name,profile_picture_url,followers_count,follows_count,media_count&access_token=${token}`
    );
    const me = await meRes.json();
    if (me.error) {
      return Response.json(
        { error: me.error.message || "Instagram API error" },
        { status: 502, headers: { ...cors } }
      );
    }

    const userId = me.id;

    // Fetch media (paginate first page)
    const mediaRes = await fetch(
      `${IG_API}/${userId}/media?fields=id,media_type,media_url,thumbnail_url,timestamp,caption&limit=50&access_token=${token}`
    );
    const mediaData = await mediaRes.json();
    const mediaList = mediaData.data || [];

    // Fetch insights for each media (views, likes, comments) – batch where possible
    const posts: Array<{
      id: string;
      cap: string;
      views: number;
      likes: number;
      cmts: number;
      shares: number;
      plat: string;
      thumbnail?: string;
      publishedAt?: string;
    }> = [];

    for (const m of mediaList.slice(0, 25)) {
      const metrics =
        m.media_type === "VIDEO" || m.media_type === "REELS"
          ? "views,likes,comments"
          : "likes,comments";
      let byName: Record<string, number> = {};
      try {
        const insRes = await fetch(
          `${IG_API}/${m.id}/insights?metric=${metrics}&access_token=${token}`
        );
        const insData = await insRes.json();
        (insData.data || []).forEach((d: { name: string; values: { value: string }[] }) => {
          byName[d.name] = parseInt(d.values?.[0]?.value || "0", 10);
        });
      } catch {}
      posts.push({
        id: m.id,
        cap: (m.caption || "").slice(0, 100) || "(Untitled)",
        views: byName.views ?? 0,
        likes: byName.likes ?? 0,
        cmts: byName.comments ?? 0,
        shares: 0,
        plat: "ig",
        thumbnail: m.thumbnail_url || m.media_url,
        publishedAt: m.timestamp,
      });
    }

    const totalViews = posts.reduce((s, p) => s + p.views, 0);
    const postViews = posts.reduce((s, p) => s + p.views, 0);
    const avgV = posts.length ? Math.round(postViews / posts.length) : 0;

    const entry = {
      channel: {
        id: userId,
        handle: me.username,
        title: me.name || me.username,
        subscribers: me.followers_count ?? 0,
        viewCount: totalViews,
        videoCount: me.media_count ?? 0,
        thumbnail: me.profile_picture_url,
        platform: "instagram",
      },
      platform: {
        handle: me.username,
        displayName: me.name || me.username,
        followers: me.followers_count ?? 0,
        channelId: userId,
        thumbnail: me.profile_picture_url,
        platformType: "instagram",
      },
      posts,
      totalViews,
      dailyViews: [], // Instagram doesn't provide daily breakdown the same way; could be added via webhooks
    };

    return Response.json(entry, { headers: { ...cors } });
  } catch (e) {
    return Response.json(
      { error: String(e) },
      { status: 500, headers: { ...cors } }
    );
  }
});
