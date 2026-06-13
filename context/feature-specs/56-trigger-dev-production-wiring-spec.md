# Unit 56 Spec: Trigger.dev Production Wiring

## Goal

Wire Trigger.dev production execution for the async solver job. The result should allow the deployed backend/frontend flow to start a solver job and receive completion status through production job infrastructure.

## Design

- Keep this unit inside deployment/config plus `jobs/` production wiring.
- Use Trigger.dev only as orchestration for solver execution.
- Do not move solver business logic into Trigger.dev job definitions.
- Production jobs must use backend-controlled solver services and result application.
- Job failures must leave saved timetable assignments recoverable.

## Implementation

### Scope

This unit should include:

- Trigger.dev production environment setup;
- production secrets configuration;
- deployed job worker;
- solver job registration verified in production;
- connection between backend solver start endpoint and production job trigger;
- production solver run smoke test;
- status verification from frontend/backend;
- logs for job start/completion/failure.

### Production Solver Smoke Test

Use a small known-good timetable dataset.

Verify:

- backend starts the job;
- job executes solver service;
- result application writes saved assignments safely;
- frontend observes solver completion through existing status integration;
- partial or failed results are displayed safely if applicable.

### Failure Safety

Force or simulate one failed job where practical and verify existing saved assignments remain unchanged.

### Out of Scope

Do not add new solver rules, soft constraints, frontend validation changes, Redis/cache infrastructure, blob storage, or deployment of unrelated services.

## Dependencies

This unit depends on Units 45, 46, and 55.

## Verification Checklist

- [ ] Trigger.dev production environment exists.
- [ ] Production secrets are configured without exposing them to frontend.
- [ ] Solver job worker is deployed.
- [ ] Backend production solver start endpoint triggers the production job.
- [ ] Job lifecycle logs appear for start, completion, and failure.
- [ ] A production smoke solver run completes successfully or with valid partial result.
- [ ] Solver result application updates saved assignments safely.
- [ ] Frontend observes solver completion through existing integration.
- [ ] A failed job leaves existing saved assignments unchanged.
- [ ] Solver business logic remains outside Trigger.dev job definitions.
