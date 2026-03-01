/**
 * Simulates the exact re-sync flow for Raw Truth Podcast YouTube
 * Run: node scripts/test-resync.mjs
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, "..", ".env");
try {
  const env = readFileSync(envPath, "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function proxy(path, params) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/scrapecreators-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ANON_KEY}`, "apikey": ANON_KEY },
    body: JSON.stringify({ path, params }),
  });
  const d = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: d };
}

async function supabaseGet(table, filter) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filter}`;
  const res = await fetch(url, { headers: { "apikey": ANON_KEY, "Authorization": `Bearer ${ANON_KEY}` } });
  return res.json();
}

// Simulate ck() and pk()
const norm = (h) => (h || "").toString().trim().toLowerCase().replace(/^@/, "");
const ck = (h, p) => `${norm(h)}::${p || "youtube"}`;
const pk = (compositeKey) => {
  const sep = "::";
  const i = (compositeKey || "").lastIndexOf(sep);
  if (i > 0) return { handle: compositeKey.slice(0, i), platform: compositeKey.slice(i + sep.length) };
  return { handle: compositeKey || "", platform: "youtube" };
};

// Simulate extractHandleFromChannelUrl (with my fix)
function extractHandleFromChannelUrl(channelUrl) {
  if (!channelUrl || typeof channelUrl !== "string") return null;
  const m = channelUrl.match(/@([a-zA-Z0-9_.@-]+)/);
  return m ? m[1].replace(/\.$/, "") : null;
}

// Test each YouTube handle
const ytHandles = ["rawtruth.podcast", "lovelogicpodcast", "lovetruthspodcast", "realtalkdiariespodcast"];

console.log("=== SIMULATING RE-SYNC FLOW ===\n");

for (const rawHandle of ytHandles) {
  const plat = "youtube";
  const compositeKey = ck(rawHandle, plat);
  console.log(`--- ${rawHandle} (key: ${compositeKey}) ---`);

  // Step 1: Get cachedRow (simulate getCachedChannelWithFallback)
  const cacheRows = await supabaseGet("channel_cache", `channel_handle=eq.${encodeURIComponent(compositeKey)}&select=channel_handle,youtube_channel_id`);
  const cachedRow = Array.isArray(cacheRows) ? cacheRows[0] : null;
  console.log(`  cachedRow: ${cachedRow ? JSON.stringify(cachedRow) : "NULL"}`);

  // Step 2: Determine cachedChannelId
  const cachedChannelId = cachedRow?.youtube_channel_id || null;
  console.log(`  cachedChannelId: ${cachedChannelId || "NULL"}`);

  // Step 3: Build variants (same logic as fetchYTChannel)
  const clean = rawHandle.replace(/^@/, "").trim();
  const noSpaces = clean.replace(/\s+/g, "");
  const variants = [
    cachedChannelId && { channelId: cachedChannelId },
    noSpaces && { handle: noSpaces },
    clean !== noSpaces && { handle: clean },
    noSpaces && { url: `https://www.youtube.com/@${noSpaces}` },
  ].filter(Boolean);

  // Step 4: Try each variant
  let found = false;
  for (const params of variants) {
    const { ok, status, data } = await proxy("/v1/youtube/channel", params);
    const id = data?.channelId ?? data?.channel_id ?? data?.id;
    if (ok && id) {
      const extractedHandle = extractHandleFromChannelUrl(data.channel) || data.handle || clean;
      console.log(`  ✓ SUCCESS with ${JSON.stringify(params)}: id=${id}, extractedHandle="${extractedHandle}"`);

      // Test videos fetch with this result
      const videoParams = { handle: extractedHandle, sort: "latest" };
      const vRes = await proxy("/v1/youtube/channel-videos", videoParams);
      const vCount = (vRes.data?.videos || vRes.data?.items || []).length;
      console.log(`  Videos (handle="${extractedHandle}"): ${vRes.ok ? `${vCount} videos` : `FAIL: ${vRes.data?.error}`}`);

      if (vCount === 0 && vRes.ok) {
        const vRes2 = await proxy("/v1/youtube/channel-videos", { channelId: id, sort: "latest" });
        const vCount2 = (vRes2.data?.videos || vRes2.data?.items || []).length;
        console.log(`  Videos (channelId="${id}"): ${vRes2.ok ? `${vCount2} videos` : `FAIL: ${vRes2.data?.error}`}`);
      }
      found = true;
      break;
    } else {
      console.log(`  ✗ FAIL with ${JSON.stringify(params)}: ${status} ${data?.error || ""}`);
    }
  }
  if (!found) console.log(`  ✗ ALL VARIANTS FAILED`);
  console.log("");
}
