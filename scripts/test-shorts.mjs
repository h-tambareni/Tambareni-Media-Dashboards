import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dir = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(join(__dir, "..", ".env"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {}

const SU = process.env.VITE_SUPABASE_URL;
const AK = process.env.VITE_SUPABASE_ANON_KEY;

const prx = async (path, params) => {
  const res = await fetch(`${SU}/functions/v1/scrapecreators-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${AK}`, "apikey": AK },
    body: JSON.stringify({ path, params }),
  });
  const d = await res.json();
  return { ok: res.ok, status: res.status, data: d };
};

const channels = [
  { label: "RawTruth.Podcast", channelId: "UCdOQBAlGE5C-mXOciuAaNVQ" },
  { label: "LoveLogicPodcast", channelId: "UCT6IQLGhplpgK9mSAhnxGBg" },
  { label: "LoveTruthsPodcast", channelId: "UCf2tSlajcAb7vkSKzQVDGlw" },
  { label: "RealTalkDiariesPodcast", channelId: "UCEppUpLfrXU_6UFhEzW_rpQ" },
];

for (const { label, channelId } of channels) {
  console.log(`\n--- ${label} (${channelId}) ---`);

  // Try shorts by channelId
  const r1 = await prx("/v1/youtube/channel/shorts", { channelId });
  console.log(`  Shorts by channelId: ${r1.ok ? `${(r1.data.shorts || []).length} shorts` : `FAIL ${r1.status}: ${r1.data?.error}`}`);
  if (r1.ok && r1.data.shorts?.length > 0) {
    console.log(`    first: "${r1.data.shorts[0].title}" views=${r1.data.shorts[0].viewCountInt || r1.data.shorts[0].viewCount || '?'}`);
  }

  // Try shorts by handle
  const r2 = await prx("/v1/youtube/channel/shorts", { handle: label });
  console.log(`  Shorts by handle "${label}": ${r2.ok ? `${(r2.data.shorts || []).length} shorts` : `FAIL ${r2.status}: ${r2.data?.error}`}`);
  if (r2.ok && r2.data.shorts?.length > 0) {
    console.log(`    first: "${r2.data.shorts[0].title}" views=${r2.data.shorts[0].viewCountInt || r2.data.shorts[0].viewCount || '?'}`);
  }

  // Try channel-videos by handle (lowercase, no dots)
  const cleanHandle = label.replace(/[.\s]/g, "").toLowerCase();
  if (cleanHandle !== label.toLowerCase()) {
    const r3 = await prx("/v1/youtube/channel-videos", { handle: cleanHandle, sort: "latest" });
    console.log(`  Videos by handle "${cleanHandle}": ${r3.ok ? `${(r3.data.videos || []).length} videos` : `FAIL ${r3.status}: ${r3.data?.error}`}`);
  }
}
