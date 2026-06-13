# Frontend Deployment to Vercel (Unit 54)

This document describes how the Vite + React frontend is deployed to Vercel,
which environment variables are required, and the security rules that govern
what may and may not be configured.

## Overview

- **Framework:** Vite (React + TypeScript), client-side routing via
  `react-router-dom`.
- **Build output:** static assets in `frontend/dist`.
- **Hosting:** Vercel static deployment with SPA fallback rewrites.
- **Config file:** [`frontend/vercel.json`](../frontend/vercel.json).

The repository is a monorepo. The frontend lives in `frontend/`, so the Vercel
project's **Root Directory must be set to `frontend`**.

## `vercel.json`

`frontend/vercel.json` pins the build so Vercel does not have to infer it:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

The rewrite is required for client-side routing: any deep link
(e.g. `/timetable`, `/units`) must serve `index.html` so React Router can take
over. Vercel applies rewrites only after checking for a matching static file,
so hashed asset requests (`/assets/*`) are served directly and are not affected.

## Environment Variables

Only **browser-safe, public** values may be configured in Vercel. Every variable
is prefixed with `VITE_` and is embedded into the client bundle at build time.

| Variable                 | Required | Notes                                                                 |
| ------------------------ | -------- | --------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Yes      | Supabase project URL (public).                                        |
| `VITE_SUPABASE_ANON_KEY` | Yes      | Supabase anon key — public by design, RLS-protected.                  |
| `VITE_API_BASE_URL`      | Yes      | Absolute backend API URL, e.g. `https://api.example.com`. See note.   |
| `VITE_SENTRY_DSN`        | Optional | Frontend Sentry DSN (public client key). Leave empty to disable.      |
| `VITE_ENVIRONMENT`       | Optional | Sentry environment tag, e.g. `production`. Defaults to the Vite mode. |

Set these for the **Production** environment (and Preview, if desired) in
Vercel → Project → Settings → Environment Variables.

### `VITE_API_BASE_URL` note

In development this is `/api` (proxied by Vite to the local backend). On Vercel
there is no proxy, so it **must be an absolute URL** pointing at the deployed
backend. Until the backend is deployed (Unit 55), point it at the intended
production backend URL. The frontend will load and authenticate (Supabase is
independent of the backend), but data-fetching API calls will fail until the
backend is live and its CORS configuration allows the Vercel origin.

## Security — what must NOT be configured

Do **not** add any of the following to Vercel frontend environment variables.
They are server-only secrets and would be exposed in the client bundle:

- Supabase **service role** key (`SUPABASE_SERVICE_KEY` / `service_role`).
- Backend `DATABASE_URL` or any database credentials.
- Trigger.dev secret keys / API keys.
- Backend Sentry DSN (the backend has its own; use only the frontend DSN here).
- Any JWT signing secrets or other server-only values.

Anything prefixed with `VITE_` is shipped to the browser. Only put values there
that are safe for the public to read.

## Manual Setup Steps (one-time)

These steps must be performed by a human in the Vercel dashboard or CLI; they
cannot be automated from this repository.

1. Create a Vercel project and connect the Git repository.
2. Set **Root Directory** to `frontend`.
3. Confirm Framework Preset is **Vite** (auto-detected; `vercel.json` pins it).
4. Add the environment variables above (Production scope at minimum).
5. Deploy.
6. Record the deployed URL in the "Deployed URL" section below.

## Verification Checklist

After deploying, verify:

- [ ] Vercel project exists with Root Directory `frontend`.
- [ ] Production build succeeds on Vercel (matches local `npm run build`).
- [ ] `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` are set.
- [ ] No backend secrets are present in Vercel env vars.
- [ ] Visiting a protected route (e.g. `/timetable`) while signed out redirects
      to `/login`.
- [ ] Login and signup succeed against Supabase from the deployed URL.
- [ ] After login, deep links (`/units`, `/rooms`) load without a 404.
- [ ] Once the backend is deployed, API-backed pages load data.
- [ ] If `VITE_SENTRY_DSN` is set, an induced error appears in Sentry.

## Deployed URL

_To be filled in after the first production deploy:_

- Production: `https://tts3-5xv0gdi40-amat2s.vercel.app`
