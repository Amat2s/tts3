# Unit 54 Spec: Frontend Deployment to Vercel

## Goal

Deploy the frontend to Vercel with production-safe environment variables. The result should make the frontend accessible from a deployed URL without exposing backend secrets.

## Design

- Keep this unit inside deployment/config and frontend deployment only.
- Deploy the built Vite frontend to Vercel.
- Configure only browser-safe environment variables.
- Do not expose Supabase service keys, backend database URLs, Trigger.dev secrets, or server-only values.
- Production frontend should point to the deployed backend API once Unit 55 is complete; until then, use the intended production API URL value or document the temporary limitation.

## Implementation

### Scope

This unit should include:

- Vercel project setup;
- frontend build command configuration;
- production environment variables:
  - `VITE_SUPABASE_URL`;
  - `VITE_SUPABASE_ANON_KEY`;
  - `VITE_API_BASE_URL`;
  - frontend Sentry DSN if used and safe;
- deployed frontend URL;
- verification that protected routes redirect correctly;
- verification that static build succeeds.

### Security

Only public frontend values may be configured in Vercel.

Do not add backend secrets or database credentials to Vercel frontend environment variables.

### Out of Scope

Do not deploy the backend, run database migrations, wire Trigger.dev production, add new frontend features, or change auth provider configuration beyond required frontend URLs.

## Dependencies

This unit depends on Unit 53.

## Verification Checklist

- [ ] Vercel project exists.
- [ ] Frontend production build succeeds.
- [ ] Required public environment variables are configured.
- [ ] No backend secrets are configured in Vercel frontend variables.
- [ ] Deployed frontend URL is documented.
- [ ] Login/signup/protected route redirects behave correctly on deployed frontend.
- [ ] Frontend can call the configured API URL when backend deployment is available.
- [ ] Unexpected frontend errors are captured if Sentry is configured.
