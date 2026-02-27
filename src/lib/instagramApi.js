/**
 * Instagram API helpers – OAuth URL builder and Edge Function invoker.
 * Token exchange and API calls run server-side in Supabase Edge Functions.
 */

const IG_API_VERSION = "v25.0";

/** Build the Instagram OAuth authorize URL for Business Login */
export function getInstagramAuthUrl(brandId) {
  const appId = import.meta.env.VITE_INSTAGRAM_APP_ID;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!appId || !supabaseUrl) {
    throw new Error("VITE_INSTAGRAM_APP_ID and VITE_SUPABASE_URL must be set");
  }
  const callbackUrl = `${supabaseUrl}/functions/v1/instagram-oauth-callback`;
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "instagram_business_basic",
    state: brandId || "",
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}

/** Call Edge Function to fetch Instagram channel data (profile + media + insights) */
export async function fetchInstagramChannel(compositeKey) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase not configured");
  }
  const res = await fetch(`${supabaseUrl}/functions/v1/instagram-fetch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ compositeKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Instagram fetch failed: ${res.status}`);
  }
  return res.json();
}
