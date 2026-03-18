// Proxies external images (e.g. Instagram CDN) to bypass hotlink/CORS blocking
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_HOSTS = [
  "scontent",
  "cdninstagram.com",
  "fbcdn.net",
  "instagram.",
  "cdn.fbsbx.com",
];

function isAllowedUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOSTS.some((h) => host.includes(h));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const urlParam = new URL(req.url).searchParams.get("url");
    if (!urlParam || !isAllowedUrl(urlParam)) {
      return new Response("Invalid or disallowed URL", {
        status: 400,
        headers: { ...cors },
      });
    }

    const imgRes = await fetch(urlParam, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TambareniMedia/1.0)",
      },
    });

    if (!imgRes.ok) {
      return new Response(null, { status: imgRes.status, headers: cors });
    }

    const contentType = imgRes.headers.get("Content-Type") || "image/jpeg";
    const body = await imgRes.arrayBuffer();
    return new Response(body, {
      headers: {
        ...cors,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return new Response(String(e), { status: 500, headers: cors });
  }
});
