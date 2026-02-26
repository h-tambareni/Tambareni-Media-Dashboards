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
