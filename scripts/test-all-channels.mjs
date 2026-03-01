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
  return res.json();
};

const channels = [
  { label: "LoveLogicPodcast", channelId: "UCT6IQLGhplpgK9mSAhnxGBg" },
  { label: "LoveTruthsPodcast", channelId: "UCf2tSlajcAb7vkSKzQVDGlw" },
  { label: "RealTalkDiariesPodcast", channelId: "UCEppUpLfrXU_6UFhEzW_rpQ" },
  { label: "RawTruth.Podcast (with dot)", channelId: "UCdOQBAlGE5C-mXOciuAaNVQ" },
  { label: "RawTruthPodcast (no dot)", channelId: "UCsYtErvYc6_44CzIvnn13xQ" },
];

for (const { label, channelId } of channels) {
  const c = await prx("/v1/youtube/channel", { channelId });
  const v = await prx("/v1/youtube/channel-videos", { channelId, sort: "latest" });
  console.log(`${label}`);
  console.log(`  channelId: ${channelId}, subs: ${c.subscriberCount}, name: ${c.name}`);
  console.log(`  videos: ${v.videos?.length ?? 0}, shorts: ${v.shorts?.length ?? 0}`);
  if (v.videos?.length > 0) console.log(`  first video: "${v.videos[0].title}"`);
  console.log("");
}
