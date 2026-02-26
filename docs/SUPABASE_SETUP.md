# Supabase Setup

## 1. Create a project

Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project.

## 2. Get credentials

In your project: **Settings → API**

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** key → `VITE_SUPABASE_ANON_KEY`

## 3. Add to .env

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 4. Run the schema

In Supabase: **SQL Editor → New query**

Paste and run the contents of `supabase/migrations/001_initial_schema.sql`.

## Tables

| Table           | Purpose                                                |
|----------------|--------------------------------------------------------|
| `brands`       | Brand containers (name, color)                         |
| `brand_channels` | Links brands to YouTube channels (brand_id, channel_handle) |
| `channel_cache` | Optional metadata cache to reduce API calls            |
