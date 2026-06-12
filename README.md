# Proxet TA Dashboard

Single-page React + Vite dashboard for a shared Talent Acquisition team event board.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Without `.env`, the app runs in demo mode with local browser storage. For the event, configure Supabase so all teammates use one shared board.

## Supabase setup

1. Create a free Supabase project.
2. Open SQL Editor and run `supabase.sql`.
3. Go to Project Settings → API and copy:
   - Project URL into `VITE_SUPABASE_URL`
   - anon public key into `VITE_SUPABASE_ANON_KEY`
4. In Database → Replication, confirm the five `ta_*` tables are enabled for realtime. The SQL attempts to add them to `supabase_realtime`; if a table is already added, Supabase may show a harmless duplicate publication message.

This board intentionally has public insert/update/read policies because the requirement is a no-login, anyone-with-the-link event board. Treat the URL as internal.

## Free deployment

Good free options:

- Vercel: easiest for Vite, free hobby tier, add the two `VITE_SUPABASE_*` environment variables, deploy from GitHub.
- Netlify: also free for static Vite sites, add the same environment variables.
- Cloudflare Pages: free static hosting, good if you already use Cloudflare.

Supabase has a free tier suitable for a small event board. Photos are stored as compressed JPEG data in Postgres rows to avoid a separate storage bucket; keep the board event-sized.

## Build

```bash
npm run build
```

The production build is generated in `dist/`.
