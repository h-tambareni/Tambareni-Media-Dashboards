# YouTube API Mapping: App Stats → API Sources

This document maps every YouTube-related stat displayed in the Tambareni Media Dashboards app to the corresponding YouTube Data API v3 and YouTube Analytics API endpoints.

---

## 1. Channel / Platform Level Stats

| App Field | Location | API Source | Endpoint / Method | Notes |
|-----------|----------|------------|-------------------|-------|
| **handle** | `brand.platforms.youtube.handle` | Data API | `channels.list` with `forHandle` or `id` | Returns `snippet.title` (channel name) |
| **followers** | `brand.platforms.youtube.followers` | Data API | `channels.list` part=`statistics` | Maps to `statistics.subscriberCount` (YouTube uses "subscribers") |
| **avgViews** | `brand.platforms.youtube.avgViews` | Analytics API | `reports.query` dimensions=`video`, metrics=`views` | Compute: sum(views) / video count over last N videos |
| **status** | `brand.platforms.youtube.status` | Business logic | - | "dead" if last upload > threshold (e.g. 6 months) |
| **last** | `brand.platforms.youtube.last` | Data API | `playlistItems.list` (uploads playlist) | From most recent video's `snippet.publishedAt` → "2d ago", "5d ago" |

---

## 2. Company Overview – Views Over Time Chart

| App Field | Location | API Source | Endpoint | Notes |
|-----------|----------|------------|----------|-------|
| **yt** (daily views) | `viewsData[].yt` | Analytics API | `reports.query` | `ids=channel==CHANNEL_ID`, `dimensions=day`, `metrics=views`, `startDate`, `endDate` |
| **Aggregated yt** | Sum across channels | - | Multiple Analytics queries | One query per connected YouTube channel, then merge by date |

---

## 3. Weekly Views (Brand View)

| App Field | Location | API Source | Endpoint | Notes |
|-----------|----------|------------|----------|-------|
| **v** (weekly views) | `wklyData[].v` | Analytics API | `reports.query` | `dimensions=day`, `metrics=views` then aggregate by week, or use `dimensions=month` for monthly |

---

## 4. Video / Post Level Stats

| App Field | Location | API Source | Endpoint | Notes |
|-----------|----------|------------|----------|-------|
| **id** | `post.id` | Data API | - | Use `video.id` from playlistItems or videos.list |
| **cap** (title) | `post.cap` | Data API | `videos.list` part=`snippet` | `snippet.title` |
| **views** | `post.views` | Data API or Analytics | Data: `videos.list` part=`statistics` → `statistics.viewCount`; Analytics: `dimensions=video`, `metrics=views` | Analytics preferred for freshness |
| **likes** | `post.likes` | Data API or Analytics | Data: `statistics.likeCount`; Analytics: `metrics=likes` | Both available |
| **cmts** (comments) | `post.cmts` | Data API or Analytics | Data: `statistics.commentCount`; Analytics: `metrics=comments` | Both available |
| **shares** | `post.shares` | Analytics API only | `reports.query` `metrics=shares` | **Not in Data API** – Analytics only |
| **plat** | `post.plat` | - | Fixed "yt" for YouTube | |
| **sr** (skip rate) | `post.sr` | Analytics API | `metrics=averageViewDuration` + Data API `contentDetails.duration` | Compute: `1 - (avgViewDuration / duration)` = portion skipped |

---

## 5. Platform Split & Top Posts

| App Field | Source | Notes |
|-----------|--------|-------|
| **YouTube %** | Analytics API | Sum of YouTube views / total views (all platforms) over date range |
| **Top posts** | Analytics API | `dimensions=video`, `metrics=views`, `sort=-views`, limit 2 |

---

## 6. Account Manager (Settings) – Connected Accounts

| App Field | Source | Notes |
|-----------|--------|-------|
| **handle** | Resolved from channel ID or forHandle | |
| **sync** | Last fetch timestamp | Application-managed |

---

## API Reference Summary

### YouTube Data API v3
- **Base URL**: `https://www.googleapis.com/youtube/v3`
- **Auth**: API key (public data) or OAuth 2.0 (private/mine)
- **Endpoints used**:
  - `GET /channels?part=statistics,snippet,contentDetails&id=...` or `forHandle=@handle`
  - `GET /playlistItems?playlistId=UU...&part=snippet` (uploads playlist)
  - `GET /videos?id=...&part=statistics,snippet,contentDetails`

### YouTube Analytics API
- **Base URL**: `https://youtubeanalytics.googleapis.com/v2/reports`
- **Auth**: OAuth 2.0 required – scope `https://www.googleapis.com/auth/yt-analytics.readonly`
- **Required params**: `ids=channel==CHANNEL_ID`, `startDate`, `endDate`, `metrics`
- **Common dimensions**: `day`, `video`, `month`
- **Common metrics**: `views`, `likes`, `comments`, `shares`, `averageViewDuration`, `estimatedMinutesWatched`
