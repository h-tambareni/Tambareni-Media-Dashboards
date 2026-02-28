# Tambareni Media Dashboards

Media analytics dashboard for multiple brands (Instagram, YouTube, TikTok).

## Setup

```bash
npm install
npm run dev
```

## YouTube API Integration

The app integrates **YouTube Data API v3** (public channel/video data) and **YouTube Analytics API** (owner analytics).

### 1. Create Google Cloud credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable **YouTube Data API v3** and **YouTube Analytics API**

### 2. API key (Data API)

- Create an API key at [Credentials](https://console.cloud.google.com/apis/credentials)
- Restrict it to YouTube Data API v3
- Copy to `.env`:

```
VITE_YOUTUBE_API_KEY=your_api_key_here
```

### 3. OAuth Client ID (Analytics API)

- Create **OAuth 2.0 Client ID** (Web application)
- Add redirect URI: `http://localhost:5173`
- Copy to `.env`:

```
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
```

### 4. Usage

- **Settings → YouTube API**: Enter a channel handle (e.g. `Tambareni Careers` or `@tambarenicareers`) and click **SYNC CHANNEL**
- **Connect YouTube (OAuth)** for Analytics data (views over time, shares, averageViewDuration for skip rate)
- Synced YouTube data appears in Brand View when you select the YouTube tab

### Stats mapping

See [docs/YOUTUBE_API_MAPPING.md](docs/YOUTUBE_API_MAPPING.md) for how each dashboard stat maps to Data API and Analytics API endpoints.

## ScrapeCreators (YouTube + TikTok)

The app uses [ScrapeCreators](https://docs.scrapecreators.com) for YouTube and TikTok channel/video data.

**Recommended (keeps API key server-side):** Use the Supabase Edge Function proxy. Set `SCRAPECREATORS_API_KEY` in Supabase → Settings → Edge Functions → Secrets, deploy the proxy, and configure Supabase in `.env`. Do not add `VITE_SCRAPECREATORS_API_KEY` to `.env`. See [INSTAGRAM_SETUP.md](INSTAGRAM_SETUP.md) for secrets table and deploy commands.

**Alternative:** Add `VITE_SCRAPECREATORS_API_KEY` to `.env` for direct client-side calls. The key will be visible in the browser.

## Daily Growth Chart & 11:59 PM Auto-Sync

The **Daily Growth** chart uses `daily_snapshots` in Supabase. Each sync writes today's total views. You need multiple days of data for the chart to show growth.

### In-browser auto-sync (when tab is open)

- Checks every 15 seconds; triggers between 11:58 PM and 12:02 AM
- Only runs when the dashboard tab is open
- If the tab is closed, the sync will not run

### Server-side cron (Supabase native – no external tools)

Uses Supabase’s built-in **pg_cron** + **pg_net** so no third-party services are needed.

1. Deploy the daily-sync function and set secrets:
   ```bash
   npx supabase functions deploy daily-sync
   npx supabase secrets set CRON_SECRET=your-random-secret-here
   ```
   For **Instagram tokens** (same format as `.env` `VITE_INSTAGRAM_TOKENS`), either:
   - **A) Supabase secrets:** `npx supabase secrets set INSTAGRAM_TOKENS='handle1:token1,handle2:token2'` (quote the whole value; in PowerShell long tokens can be mangled)
   - **B) Database (recommended):** Run in Supabase SQL Editor:
     ```sql
     insert into cron_config (key, value) values (
       'instagram_tokens',
       'lovelogicpodcast:YOUR_TOKEN,lovetruthspodcast:YOUR_TOKEN2,realtruthspodcast:YOUR_TOKEN3'
     ) on conflict (key) do update set value = excluded.value;
     ```
     Paste the exact string from your `.env` `VITE_INSTAGRAM_TOKENS` – no shell escaping issues.

2. Push the migration (enables pg_cron and schedules the job):
   ```bash
   npx supabase db push
   ```

3. Register the sync URL in the database (run once in Supabase SQL Editor):
   ```sql
   insert into cron_config (key, value) values (
     'daily_sync_url',
     'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-sync?secret=YOUR_CRON_SECRET'
   ) on conflict (key) do update set value = excluded.value;
   ```
   Replace `YOUR_PROJECT_REF` and `YOUR_CRON_SECRET` with your values.

After that, the job runs at 11:59 PM every day inside Supabase.
