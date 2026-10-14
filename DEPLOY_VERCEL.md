# Deploying Quantnance to Vercel

Quantnance ships as **two separate Vercel projects inside this one GitHub
repository**, each pointed at a different root directory. Vercel's "Root
Directory" project setting lets you share one git remote across both.

| Vercel project | Root directory | Framework preset | Runtime |
| -------------- | -------------- | ---------------- | ------- |
| `quantnance-api` (backend) | `server` | Other (zero-config Python) | Python 3.12, Fluid Compute |
| `quantnance-web` (frontend) | `client` | Vite | Node (static build) |

## 1. First-time deploy commands

From the repo root, run these in two separate terminals (or back-to-back):

```bash
cd server && vercel
```

```bash
cd client && vercel
```

On first invocation, the Vercel CLI will prompt you to link each directory to
a new project. Accept the detected framework (`Other` for `server`, `Vite` for
`client`), then set the environment variables below in the dashboard before
promoting to production with `vercel --prod` from each directory.

## 2. Required environment variables

Set these in each Vercel project's **Settings → Environment Variables**.
Scope them to Production (and Preview, if you want preview deployments to
hit the live upstream services).

### Backend project (`quantnance-api`, root = `server`)

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `GROQ_API_KEY` | yes | Groq LLM key — `console.groq.com`. |
| `NEWS_API_KEY` | yes | `newsapi.org`. |
| `BAYSE_PUBLIC_KEY` | yes | Bayse prediction markets. |
| `CLERK_JWKS_URL` | yes | Clerk's JWKS endpoint, e.g. `https://<your-tenant>.clerk.accounts.dev/.well-known/jwks.json`. |
| `CLERK_PUBLISHABLE_KEY` | optional | Exposed via `/api/app-config`; falls back to `VITE_CLERK_PUBLISHABLE_KEY` if unset. |
| `FRONTEND_URL` | yes (after step 4) | Deployed frontend origin — enables CORS. Multiple domains can go in `FRONTEND_URLS`, comma-separated. |
| `DATABASE_URL` | **recommended** | Managed Postgres URL (`postgresql://…`). The default SQLite fallback is NOT durable on Vercel — see "Known deployment caveats" below. |

### Frontend project (`quantnance-web`, root = `client`)

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `VITE_API_URL` | yes | Deployed backend origin, e.g. `https://quantnance-api.vercel.app`. No trailing slash. |
| `VITE_CLERK_PUBLISHABLE_KEY` | yes | Clerk publishable key (production instance). |

Both lists are also mirrored in `server/.env.example` and
`client/.env.production.example`.

## 3. Zero-config detection summary

- **Backend**: Vercel detects FastAPI because `server/main.py` exports a
  module-level `app = FastAPI(...)`. `server/.python-version` pins the
  interpreter to **3.12**. The only override we ship is
  `server/vercel.json`, which raises `maxDuration` to **60 s** for `main.py`
  because `/api/brief` and `/api/analyze` fan out to three external data
  APIs plus Groq.
- **Frontend**: `client/vite.config.ts` is clean — no dev-only proxy leaks
  into the production build. Vercel runs `npm run build` and serves
  `client/dist/`.

## 4. After the first backend deploy — update CORS

The backend already allows `https://quantnance.vercel.app` as a *placeholder*
origin (see the TODO in `server/main.py :: _cors_origins`). Once the real
frontend URL is known (e.g. `https://quantnance-web.vercel.app` and/or a
custom domain):

1. In the backend Vercel project, set
   `FRONTEND_URL=https://your-real-frontend.vercel.app`
   (or `FRONTEND_URLS=https://a.vercel.app,https://quantnance.com` for several).
2. Redeploy the backend (`cd server && vercel --prod`) — the CORS allow-list
   rebuilds from env at process start.
3. Optional: edit the TODO comment in `server/main.py` and remove the
   placeholder origin for cleanliness.

## 5. Known deployment caveats (test before going live)

- **In-memory caches** (brief, stocks, news, bayse, auth JWKS, Groq client)
  are per-instance on Fluid Compute and will be wiped on scale-out / cold
  starts. They stay as best-effort speed hints only — comments in each file
  document this. No correctness impact expected, but p95 latency may rise
  under traffic spikes.
- **Disk cache under `server/cache/`** no longer works on Vercel's read-only
  filesystem. The writes are already wrapped in `try/except` so this
  degrades silently to the in-memory layer.
- **SQLite fallback**: `server/database.py` defaults to
  `server/quantnance.db`. On Vercel this file lives on a read-only FS and
  will fail at write time. You MUST set `DATABASE_URL` to a managed
  Postgres before any `/api/history` write will persist.
- **`/api/brief` and `/api/analyze` duration**: `vercel.json` raises the
  limit to 60 s, but if any upstream (Yahoo, NewsAPI, Bayse, Groq) is
  consistently slow we could still bump the ceiling. The per-fetch 10 s
  timeout + `asyncio.wait_for` wrapper means a single slow source returns
  partial data instead of blocking the whole call — verify this manually
  under realistic load before promoting to production.
