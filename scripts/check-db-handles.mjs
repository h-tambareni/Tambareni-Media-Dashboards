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

async function query(table, select = "*") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${select}`, {
    headers: { "apikey": ANON_KEY, "Authorization": `Bearer ${ANON_KEY}` },
  });
  return res.json();
}

const channels = await query("brand_channels", "channel_handle,platform,youtube_channel_id");
console.log("brand_channels:");
channels.filter(r => r.platform === "youtube").forEach(r => {
  console.log(`  handle="${r.channel_handle}"  youtube_channel_id=${r.youtube_channel_id || "NULL"}`);
});

const cache = await query("channel_cache", "channel_handle,youtube_channel_id,last_synced_at");
console.log("\nchannel_cache (youtube entries):");
cache.filter(r => !r.channel_handle.includes("tiktok") && !r.channel_handle.includes("instagram")).forEach(r => {
  console.log(`  handle="${r.channel_handle}"  youtube_channel_id=${r.youtube_channel_id || "NULL"}  last_synced=${r.last_synced_at}`);
});
