// Proxies Google Analytics 4 Data API – uses service account credentials server-side.
// Set GA_SERVICE_ACCOUNT_JSON as a Supabase Edge Function secret containing the full
// service account JSON key from Google Cloud Console.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Generate a JWT and exchange it for a Google access token. */
async function getAccessToken(sa: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = btoa(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsignedJwt = `${header}.${claims}`;

  // Import private key
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedJwt)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const jwt = `${header}.${claims}.${sigB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(tokenData.error_description || "Token exchange failed");
  return tokenData.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const saJson = (Deno.env.get("GA_SERVICE_ACCOUNT_JSON") || "").trim();
    if (!saJson) {
      return Response.json(
        { error: "GA_SERVICE_ACCOUNT_JSON not configured. Set up a Google Cloud service account and add the JSON key as a Supabase secret." },
        { status: 500, headers: cors }
      );
    }

    const sa = JSON.parse(saJson);
    const accessToken = await getAccessToken(sa);

    const { propertyId, reportType, body } = await req.json();
    if (!propertyId) {
      return Response.json({ error: "propertyId required" }, { status: 400, headers: cors });
    }

    const endpoint =
      reportType === "realtime"
        ? `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`
        : `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error?.message || `GA4 API: HTTP ${res.status}`;
      return Response.json({ error: msg }, { status: res.status, headers: cors });
    }

    return Response.json(data, { headers: cors });
  } catch (e) {
    return Response.json(
      { error: String(e) },
      { status: 500, headers: cors }
    );
  }
});
