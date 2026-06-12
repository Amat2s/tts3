# Unit 49 Spec: Backend Observability

## Goal

Add backend observability for API failures, solver orchestration, and saved-timetable operations. The result should make backend failures traceable without changing product behavior or exposing internal details to users.

## Design

- Keep this unit inside `backend/`.
- Use Sentry for unexpected backend exceptions.
- Keep existing structured logging with `structlog`; do not replace the logging foundation.
- Treat solver runs, assignment saves, and defensive save rejections as first-class log events.
- Use correlation IDs or job IDs where available, especially for solver start/status/job flows.
- Do not log sensitive student payloads, full auth tokens, database URLs, or Supabase secrets.
- Observability must not become product logic. Logging and exception capture should observe behavior, not drive behavior.

## Implementation

### Scope

This unit should include:

- Sentry backend setup;
- backend configuration for `SENTRY_DSN` and environment name;
- structured logging for saved-timetable assignment operations;
- structured logging for solver start/status flows;
- structured logging for async solver job lifecycle where backend code participates;
- correlation ID or request ID middleware if not already present;
- consistent capture of unexpected exceptions;
- safe log payload conventions.

### Logging Events

Add structured logs for:

- assignment save requested;
- assignment save succeeded;
- assignment save defensively rejected because blocked-placement invariants were violated;
- solver start requested;
- solver start rejected because saved state is not solver-ready;
- solver job/status lookup;
- solver result application succeeded;
- solver result application failed.

Logs should prefer counts and IDs over large payloads.

### Error Capture

Unexpected backend exceptions should be sent to Sentry when a DSN is configured.

Expected product errors, such as validation failures or defensive assignment-save rejection, should still return normal structured API errors. They may be logged at warning level, but should not be treated as crashes.

### Out of Scope

Do not implement frontend Sentry, frontend error boundaries, new API behavior, new solver behavior, new validation behavior, or deployment configuration in this unit.

## Dependencies

This unit depends on Unit 46. Add only the Sentry backend package if it is not already installed.

## Verification Checklist

- [ ] Backend Sentry configuration exists and is environment-driven.
- [ ] Backend runs when `SENTRY_DSN` is absent.
- [ ] Unexpected backend exceptions are captured when Sentry is configured.
- [ ] Saved-timetable assignment operations emit structured logs.
- [ ] Defensive assignment-save rejections are logged without exposing full payloads.
- [ ] Solver start/status/result flows emit structured logs.
- [ ] Logs include useful IDs or correlation context where available.
- [ ] Auth tokens, secrets, full student lists, and database URLs are not logged.
- [ ] Expected validation failures still return normal structured API errors.
- [ ] No product behavior is changed by observability code.
