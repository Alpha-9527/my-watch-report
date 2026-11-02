# My Watch Report

Personal Trakt watch-history dashboard for Cloudflare.

## Architecture
- `web/`: React + TypeScript + Vite dashboard (deploy to Cloudflare Pages)
- `worker/`: Cloudflare Worker API, OAuth PKCE callback, hourly sync (deploy separately)
- `worker/schema.sql`: D1 schema

The project is a starter implementation. It intentionally stores watch events separately from title metadata so rewatches remain countable.

## Prerequisites
- Node.js 20+
- Cloudflare account, Wrangler 4+
- A Trakt API app: https://trakt.tv/oauth/applications
- A Cloudflare D1 database

## 1. Create D1
```bash
cd worker
npx wrangler d1 create my-watch-report
```
Copy the returned `database_id` into `worker/wrangler.toml`, then:
```bash
npx wrangler d1 execute my-watch-report --remote --file=./schema.sql
```

## 2. Configure the Worker
Edit `worker/wrangler.toml`:
- Set `database_id`
- Set `APP_ORIGIN` to your Pages URL
- Set `TRAKT_CLIENT_ID` as a variable (Client ID is public)
- Set `TRAKT_REDIRECT_URI` to `https://YOUR-WORKER.workers.dev/api/auth/callback`

Set the dashboard origin as a secret:
```bash
npx wrangler secret put APP_ORIGIN
```
(Alternatively keep it as a plain `vars` entry; it is not a credential.)
Deploy:
```bash
npx wrangler deploy
```

## 3. Configure Trakt
In the Trakt application settings, register the exact redirect URI:
`https://YOUR-WORKER.workers.dev/api/auth/callback`

This starter uses OAuth Authorization Code + PKCE. It does not require a client secret for user sign-in. The callback URI must match exactly.

## 4. Configure the dashboard
In `web/.env.example`, set:
```env
VITE_API_BASE=https://YOUR-WORKER.workers.dev
```
Then:
```bash
cd ../web
npm install
npm run dev
```
Deploy `web/dist` to Cloudflare Pages after:
```bash
npm run build
```

## 5. Hourly sync
The Worker has a Cron Trigger every hour (`0 * * * *`, UTC). It refreshes OAuth tokens when needed and syncs recent Trakt history with pagination and event-ID upserts.

## API routes
- `GET /api/health`
- `GET /api/auth/start` (redirects to Trakt)
- `GET /api/auth/callback`
- `GET /api/status`
- `POST /api/sync` (manual sync; dashboard action)
- `GET /api/summary?year=2026`
- `GET /api/history?limit=50&offset=0`

## Notes / next development steps
1. Add richer title metadata and credits enrichment for director/actor charts.
2. Add annual narrative generation and export.
3. Add authentication in front of the dashboard if it will be publicly accessible. This starter is intended for a private personal deployment; do not expose the Worker URL as a public multi-user service.
4. The first sync imports the most recent history pages. Increase `INITIAL_SYNC_PAGES` carefully if you have a large history.
5. Runtime-based duration is an estimate: TV episodes use episode runtime when available; movies use movie runtime. Trakt history may not contain all credit/runtime fields in every response.
