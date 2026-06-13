# Backend Deployment to Railway (Unit 55)

This document describes how the FastAPI backend is deployed to Railway, which
environment variables are required, how production Alembic migrations are run
deliberately, and the security rules that govern what may and may not be
configured.

> Depends on Unit 49 (backend observability) and Unit 54 (frontend on Vercel).
> Trigger.dev worker deployment is covered separately in
> [trigger-dev-deployment.md](./trigger-dev-deployment.md) (Unit 56).

## Overview

- **Framework:** FastAPI (ASGI), served by `uvicorn`.
- **Hosting:** Railway service, built with Nixpacks (auto-detects
  `requirements.txt` and Python).
- **Database:** production Supabase Postgres (connected via `DATABASE_URL`).
- **Config file:** [`backend/railway.json`](../backend/railway.json).
- **Health check:** `GET /health` → `{"status": "ok"}`.

The repository is a monorepo. The backend lives in `backend/`, so the Railway
service's **Root Directory must be set to `backend`**. With the root set,
Nixpacks finds `backend/requirements.txt` and `backend/railway.json` and builds
only the backend.

## `railway.json`

`backend/railway.json` pins the build/deploy so Railway does not have to infer
them:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Notes:

- The app is imported as `main:app` and the working directory is `backend/`
  (matching local convention — see the architecture decision in the progress
  tracker). Import paths omit the `backend.` prefix.
- `--host 0.0.0.0` and `--port $PORT` are required: Railway injects `$PORT` and
  routes external traffic to it. Do not hard-code a port.
- The start command **does not** run migrations. Migrations are run
  deliberately and checked (see below), never automatically on every deploy.
- `healthcheckPath: /health` lets Railway confirm the service is live before
  routing traffic.

## Environment Variables

Set these on the Railway service (Settings → Variables). These are
**server-side secrets** and must never be exposed to the frontend.

| Variable                 | Required    | Notes                                                                                           |
| ------------------------ | ----------- | ----------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | Yes         | Production Supabase Postgres connection string. Use the connection-pooler URL for serverless.   |
| `SUPABASE_URL`           | Yes         | Supabase project URL — used to fetch JWKS for verifying admin JWTs (`{SUPABASE_URL}/auth/...`). |
| `CORS_ORIGINS`           | Yes         | JSON array of allowed origins. See CORS section. **No production wildcard.**                    |
| `ENVIRONMENT`            | Recommended | Tags Sentry events/logs, e.g. `production`.                                                     |
| `SENTRY_DSN`             | Optional    | Backend Sentry DSN. Leave empty to disable; the app runs normally without it.                   |
| `TRIGGER_SECRET_KEY`     | Prod solver | Trigger.dev production server API key so `POST /solver/start` queues the real task. See [trigger-dev-deployment.md](./trigger-dev-deployment.md). |
| `TRIGGER_API_URL`        | Optional    | Defaults to `https://api.trigger.dev`.                                                          |
| `TRIGGER_SOLVER_TASK_ID` | Optional    | Defaults to `solver-job`.                                                                       |
| `SOLVER_INTERNAL_TOKEN`  | Prod solver | Shared secret authorizing the Trigger.dev worker to call `POST /solver/internal/execute`. Must match the worker's `SOLVER_EXECUTE_TOKEN`. Never expose to the frontend. |

`PORT` is provided automatically by Railway — do not set it manually.

### `DATABASE_URL` format

`config.py` builds the SQLAlchemy engine directly from `DATABASE_URL`, and
`alembic/env.py` reads the same variable for migrations. Use the standard
`postgresql://...` (psycopg2) URL from the Supabase dashboard
(Project → Settings → Database). Prefer the **connection pooler** (PgBouncer)
URI for a hosted app.

## CORS

`CORS_ORIGINS` is parsed by pydantic-settings as a JSON list. Set it to the
exact deployed frontend origin(s) — and only those:

```
CORS_ORIGINS=["https://tts3-5xv0gdi40-amat2s.vercel.app"]
```

To also allow local development against the deployed backend, add the dev origin
explicitly:

```
CORS_ORIGINS=["https://tts3-5xv0gdi40-amat2s.vercel.app","http://localhost:5173"]
```

Do **not** use `["*"]` in production. The app sends `allow_credentials=True`
(see [`main.py`](../backend/main.py)), and a wildcard with credentials is both
insecure and rejected by browsers.

## Production Migration Process

Migrations are run intentionally and checked. **Do not** modify the production
schema outside Alembic, and **do not** wire `alembic upgrade head` into the
start command.

Run migrations once after the service is configured with `DATABASE_URL` (and
again whenever new migrations are added), using the Railway CLI to execute the
command inside the deployed environment:

```bash
# from backend/, with the Railway project linked (railway link)
railway run alembic upgrade head
```

`railway run` injects the service's environment variables (including
`DATABASE_URL`) into the local process, so Alembic targets the production
Supabase database. Alternatively, run a one-off command from the Railway
dashboard.

Verify and check the result:

```bash
railway run alembic current   # should report the latest revision (0008)
```

Current head migration: `0008_create_solver_runs`. The full chain is
`0001` → `0002` → `0003` → `0004` → `0005` → `0006` → `0007` → `0008`.

`python-dotenv` is pinned in `requirements.txt` because `alembic/env.py` imports
it; without it the migration command fails in a clean environment.

## Security — what must NOT be exposed to the frontend

These are server-only and must never appear in Vercel/`VITE_` variables or the
client bundle:

- `DATABASE_URL` / any database credentials.
- Supabase **service role** key (the backend uses JWKS verification, not the
  service key, but never expose it regardless).
- `TRIGGER_SECRET_KEY` / any Trigger.dev secret keys.
- `SOLVER_INTERNAL_TOKEN` (the internal solver execution shared secret).
- Backend `SENTRY_DSN` (the frontend has its own public DSN; do not reuse this
  one there).
- Any JWT signing secrets.

The backend reads these from its own Railway environment only. The frontend
talks to the backend exclusively over HTTPS with a Supabase Bearer token.

## Manual Setup Steps (one-time)

These must be performed by a human in the Railway dashboard or CLI; they cannot
be automated from this repository.

1. Create a Railway project and add a service from the Git repository.
2. Set the service **Root Directory** to `backend`.
3. Confirm the builder is **Nixpacks** (auto-detected; `railway.json` pins it).
4. Add the environment variables above (`DATABASE_URL`, `SUPABASE_URL`,
   `CORS_ORIGINS`, `ENVIRONMENT`, and `SENTRY_DSN` if used).
5. Deploy and wait for the health check on `/health` to pass.
6. Run the production migrations deliberately:
   `railway run alembic upgrade head`, then `railway run alembic current` to
   confirm the head revision.
7. Record the deployed backend URL in the "Deployed URL" section below.
8. In Vercel, set the frontend `VITE_API_BASE_URL` to the deployed backend URL
   (absolute, e.g. `https://<service>.up.railway.app`) and redeploy the
   frontend so it points at the live backend.
9. Confirm `CORS_ORIGINS` on Railway contains the exact Vercel frontend origin.

## Verification Checklist

After deploying, verify (mirrors the Unit 55 spec):

- [ ] Railway backend service exists with Root Directory `backend`.
- [ ] Backend starts successfully in production (deploy logs clean, no crash).
- [ ] Production environment variables are configured securely (set on Railway,
      not in the repo or the frontend).
- [ ] `railway run alembic upgrade head` runs successfully against the
      production database; `alembic current` reports `0008`.
- [ ] `GET https://<backend-url>/health` returns `{"status": "ok"}`.
- [ ] A protected endpoint (e.g. `GET /auth/verify`) returns `401` without a
      Bearer token.
- [ ] The same protected endpoint returns `200` with a valid Supabase admin
      token from the deployed frontend.
- [ ] CORS allows the deployed Vercel origin and is **not** a `["*"]` wildcard.
- [ ] Vercel `VITE_API_BASE_URL` points at the deployed backend URL and
      API-backed pages load data.
- [ ] No backend secrets (`DATABASE_URL`, Trigger/Sentry secrets, JWT secrets)
      are present in any `VITE_`/Vercel variable or the client bundle.

## Deployed URL

_To be filled in after the first production deploy:_

- Backend production URL: `https://glistening-quietude-production-4f28.up.railway.app`
