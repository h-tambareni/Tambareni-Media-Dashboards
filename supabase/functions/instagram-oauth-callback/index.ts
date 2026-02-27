// Instagram OAuth callback – exchanges code for token, saves to brand_channels, redirects to app
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // brandId
  const error = url.searchParams.get("error");

  const appUrl = Deno.env.get("VITE_APP_URL") || "http://localhost:5173";
  const redirect = (path: string, q?: Record<string, string>) => {
    const u = new URL(path, appUrl);
    if (q) Object.entries(q).forEach(([k, v]) => u.searchParams.set(k, v));
    return Response.redirect(u.toString(), 302);
  };

  if (error) {
    return redirect("/", { instagram: "error", error: error });
  }
  if (!code || !state) {
    return redirect("/", { instagram: "error", error: "missing_params" });
  }

  const appId = Deno.env.get("INSTAGRAM_APP_ID");
  const appSecret = Deno.env.get("INSTAGRAM_APP_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!appId || !appSecret) {
    return redirect("/", { instagram: "error", error: "server_config" });
  }

  const callbackUrl = `${supabaseUrl}/functions/v1/instagram-oauth-callback`;

  try {
    // 1. Exchange code for short-lived token
    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return redirect("/", { instagram: "error", error: tokenData.error_message || "token_exchange" });
    }
    const shortToken = tokenData.access_token;
    const userId = tokenData.user_id;

    // 2. Exchange for long-lived token (60 days)
    const longRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`
    );
    const longData = await longRes.json();
    const accessToken = longData.access_token || shortToken;
    const expiresIn = longData.expires_in || 5184000; // 60 days in seconds
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 3. Get username from /me
    const meRes = await fetch(
      `https://graph.instagram.com/v25.0/me?fields=username&access_token=${accessToken}`
    );
    const meData = await meRes.json();
    const username = (meData.username || userId || "").toLowerCase().replace(/^@/, "");

    // 4. Insert into brand_channels
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { error: insertErr } = await supabase.from("brand_channels").insert({
      brand_id: state,
      channel_handle: username,
      platform: "instagram",
      instagram_user_id: userId,
      instagram_access_token: accessToken,
      access_token_expires_at: expiresAt,
    });

    if (insertErr) {
      if (insertErr.code === "23505") {
        // Unique violation – already added; update token instead
        await supabase
          .from("brand_channels")
          .update({
            instagram_access_token: accessToken,
            access_token_expires_at: expiresAt,
          })
          .eq("brand_id", state)
          .eq("channel_handle", username)
          .eq("platform", "instagram");
      } else {
        return redirect("/", { instagram: "error", error: insertErr.message });
      }
    }

    return redirect("/", { instagram: "success", brandId: state });
  } catch (e) {
    return redirect("/", { instagram: "error", error: String(e) });
  }
});
