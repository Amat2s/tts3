# Unit 55 Spec: Backend Deployment to Railway

## Goal

Deploy the FastAPI backend to Railway with production environment variables, Supabase database connectivity, migrations, CORS, and health checks. The result should let the deployed frontend call the deployed backend.

## Design

- Keep this unit inside deployment/config and backend deployment only.
- Deploy the FastAPI backend to Railway.
- Configure production environment variables securely.
- Run Alembic migrations against the production Supabase database deliberately.
- Configure CORS for the deployed Vercel frontend URL.
- Do not deploy Trigger.dev workers in this unit.

## Implementation

### Scope

This unit should include:

- Railway service setup;
- backend start command;
- production backend environment variables:
  - `DATABASE_URL`;
  - `SUPABASE_URL`;
  - CORS origins;
  - backend Sentry DSN if used;
  - any solver/job status variables needed by implemented backend APIs;
- production Alembic migration process;
- health endpoint verification;
- protected endpoint verification;
- deployed backend URL documented;
- Vercel frontend `VITE_API_BASE_URL` updated to the deployed backend URL.

### Migration Safety

Migrations should be run intentionally and checked.

Do not manually modify production schema outside Alembic.

### CORS

Allow only required deployed frontend origins plus any explicitly needed local development origins.

### Out of Scope

Do not deploy Trigger.dev workers, add new backend features, modify the solver architecture, add Redis/cache infrastructure, or introduce multi-tenant behavior.

## Dependencies

This unit depends on Units 49 and 54.

## Verification Checklist

- [ ] Railway backend service exists.
- [ ] Backend starts successfully in production.
- [ ] Production environment variables are configured securely.
- [ ] Alembic migrations run successfully against production database.
- [ ] Health endpoint responds on deployed backend.
- [ ] Protected endpoint rejects unauthenticated requests.
- [ ] Protected endpoint accepts valid authenticated frontend requests.
- [ ] CORS allows the deployed frontend and does not use a broad production wildcard.
- [ ] Vercel frontend points to deployed backend API URL.
- [ ] No backend secrets are exposed to frontend.
