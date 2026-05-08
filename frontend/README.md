## Orvex Frontend

This app is structured for a Vercel-native deployment:

- Next.js App Router UI and route handlers
- Supabase Auth and Postgres
- Same-origin `/api` routes for research and market data
- No FastAPI runtime dependency

## Required Environment Variables

Public:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

Server only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ORVEX_ENCRYPTION_KEY`
- `FINNHUB_API_KEY` optional
- `POLYGON_API_KEY` optional
- `ALPHA_VANTAGE_API_KEY` optional
- `FMP_API_KEY` optional

User-managed provider keys are stored encrypted in Supabase through `/api/keys`.

## Supabase Setup

Run the SQL migration in [supabase/migrations/20260508_vercel_native.sql](/C:/Users/praty/orvex/frontend/supabase/migrations/20260508_vercel_native.sql).

This creates:

- `profiles`
- `provider_keys`
- `research_queries`
- `model_responses`
- `syntheses`
- row-level security policies scoped to `auth.uid()`

## Local Development

```bash
npm install
npm run dev
```

The app should run without any localhost backend. All requests go to Next.js route handlers.
