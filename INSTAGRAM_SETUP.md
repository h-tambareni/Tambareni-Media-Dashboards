# Instagram Integration Setup

Instagram accounts are added via **Business Login** (OAuth) – users click "Connect with Instagram" and authorize in one step. No manual token generation needed.

## 1. Meta Developer App

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Create a **Business** app (or use existing)
3. Add the **Instagram** product
4. In **Instagram > API setup with Instagram business login**:
   - Complete **Business login settings**
   - Add **OAuth redirect URI**: `https://YOUR_PROJECT.supabase.co/functions/v1/instagram-oauth-callback`
   - Copy **Instagram App ID** → `VITE_INSTAGRAM_APP_ID`

## 2. Environment Variables

### Frontend (.env)

```
VITE_INSTAGRAM_APP_ID=your_instagram_app_id
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Optional – for OAuth redirect after connect (defaults to `http://localhost:5173`):

```
VITE_APP_URL=https://your-production-domain.com
```

### Supabase Edge Function Secrets

Set these in [Supabase Dashboard](https://supabase.com/dashboard) → Project → Settings → Edge Functions → Secrets:

| Secret | Value |
|--------|-------|
| `INSTAGRAM_APP_ID` | Same as VITE_INSTAGRAM_APP_ID |
| `INSTAGRAM_APP_SECRET` | From Meta App Dashboard → Instagram → Business login settings |
| `SCRAPECREATORS_API_KEY` | Your ScrapeCreators API key (keeps it server-side; no need for VITE_SCRAPECREATORS_API_KEY in .env) |
| `VITE_APP_URL` | Your app URL (e.g. `https://your-domain.com`) – optional |

## 3. Deploy Edge Functions

```bash
# From project root
supabase functions deploy instagram-oauth-callback
supabase functions deploy instagram-fetch
supabase functions deploy scrapecreators-proxy
```

## 4. Database Migration

```bash
supabase db push
```

Or run `supabase/migrations/005_instagram_schema.sql` in the SQL Editor.

## 5. Meta App Review (for production)

- **Standard Access**: Works for accounts you own/manage
- **Advanced Access**: Required to serve other businesses’ accounts – submit for App Review with `instagram_business_basic`

## Flow

1. User clicks **+ ADD ACCOUNT** → selects **Instagram** → selects brand → **Connect with Instagram**
2. Redirects to Instagram → user authorizes
3. Callback Edge Function exchanges code for token → saves to `brand_channels`
4. Redirects back to app → brands refetched → account appears
5. Data is fetched via `instagram-fetch` Edge Function (profile, media, insights)
