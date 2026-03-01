/**
 * Test script: call ScrapeCreators YouTube channel API with different handle formats.
 * Run: node scripts/test-youtube-fetch.mjs
 * Uses Supabase proxy (needs VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in .env)
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env");
try {
  const env = readFileSync(envPath, "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {}
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function callProxy(path, params) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/scrapecreators-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ANON_KEY}`,
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({ path, params }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  if (!SUPABASE_URL || !ANON_KEY) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
    process.exit(1);
  }

  // Simulate extractHandleFromChannelUrl
  function extractHandleFromChannelUrl(channelUrl) {
    if (!channelUrl || typeof channelUrl !== "string") return null;
    const m = channelUrl.match(/@([a-zA-Z0-9_.@-]+)/);
    return m ? m[1].replace(/\.$/, "") : null;
  }
  const testUrls = [
    "http://www.youtube.com/@RawTruth.Podcast",
    "http://www.youtube.com/@RawTruthPodcast",
    "https://www.youtube.com/@ThePatMcAfeeShow",
  ];
  console.log("extractHandleFromChannelUrl tests:");
  for (const url of testUrls) {
    console.log(`  ${url} => "${extractHandleFromChannelUrl(url)}"`);
  }
  console.log("");

  // Simulate our fetchYTChannel variant order for "raw truth podcast" (stored display name)
  console.log("Simulating our variant order for handle 'raw truth podcast':\n");
  const clean = "raw truth podcast".replace(/^@/, "").trim();
  const noSpaces = clean.replace(/\s+/g, "");
  const ourVariants = [
    noSpaces && { handle: noSpaces },
    clean !== noSpaces && { handle: clean },
    noSpaces && { url: `https://www.youtube.com/@${noSpaces}` },
  ].filter(Boolean);
  for (const params of ourVariants) {
    const { ok, status, data } = await callProxy("/v1/youtube/channel", params);
    const id = data?.channelId ?? data?.channel_id ?? data?.id;
    console.log(`${ok && id ? "✓" : "✗"} ${JSON.stringify(params)} => ${ok && id ? `channelId=${id}` : `FAILED (${data?.error || status})`}`);
  }
  console.log("\n--- All handle format variants ---\n");

  // Raw Truth Podcast - try multiple handle formats
  const variants = [
    { name: "handle (no @, lowercase no spaces)", params: { handle: "rawtruthpodcast" } },
    { name: "handle with @", params: { handle: "@rawtruthpodcast" } },
    { name: "handle with dot", params: { handle: "rawtruth.podcast" } },
    { name: "handle @ and dot", params: { handle: "@RawTruth.Podcast" } },
    { name: "handle camelCase", params: { handle: "RawTruthPodcast" } },
    { name: "handle exact YouTube style", params: { handle: "RawTruth.Podcast" } },
    { name: "url with @", params: { url: "https://www.youtube.com/@RawTruthPodcast" } },
    { name: "url with dot", params: { url: "https://www.youtube.com/@RawTruth.Podcast" } },
    { name: "handle with spaces", params: { handle: "raw truth podcast" } },
  ];

  console.log("Testing ScrapeCreators YouTube channel API (Raw Truth Podcast)\n");

  for (const { name, params } of variants) {
    const { ok, status, data } = await callProxy("/v1/youtube/channel", params);
    const id = data?.channelId ?? data?.channel_id ?? data?.id;
    const err = data?.error ?? data?.message;
    console.log(`${ok && id ? "✓" : "✗"} ${name}`);
    console.log(`   Params: ${JSON.stringify(params)}`);
    if (ok && id) {
      console.log(`   SUCCESS: channelId=${id}, name=${data?.name || "—"}`);
    } else {
      console.log(`   FAILED: status=${status}, id=${id || "none"}, error=${err || "Channel not found"}`);
    }
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
