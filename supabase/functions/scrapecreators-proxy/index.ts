// Proxies ScrapeCreators API – keeps API key server-side
const BASE = "https://api.scrapecreators.com";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const apiKey = (Deno.env.get("SCRAPECREATORS_API_KEY") || "").trim();
    if (!apiKey) {
      return Response.json(
        { error: "SCRAPECREATORS_API_KEY not configured in Edge Function secrets" },
        { status: 500, headers: { ...cors } }
      );
    }

    const { path, params } = await req.json();
    if (!path || typeof path !== "string") {
      return Response.json({ error: "path required" }, { status: 400, headers: { ...cors } });
    }
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const search = new URLSearchParams(params || {}).toString();
    const url = `${BASE}${cleanPath}${search ? `?${search}` : ""}`;

    const res = await fetch(url, { headers: { "x-api-key": apiKey } });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const code = res.status;
      const msg =
        code === 402 ? "ScrapeCreators: Out of credits" :
        code === 401 ? "ScrapeCreators: Invalid API key" :
        (data?.message) || `ScrapeCreators API: HTTP ${code}`;
      return Response.json({ error: msg }, { status: res.status, headers: { ...cors } });
    }

    return Response.json(data, { headers: cors });
  } catch (e) {
    return Response.json(
      { error: String(e) },
      { status: 500, headers: { ...cors } }
    );
  }
});
