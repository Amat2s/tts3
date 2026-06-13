# Trigger.dev Production Wiring (Unit 56)

This document describes how the async solver job is wired for production
execution: how the deployed Trigger.dev worker runs the backend solver, which
secrets are required, how to run the production smoke test, and how failure
safety is verified.

> Depends on Units 45 (async solver job), 46 (solver start/status API), and 55
> (backend on Railway). The frontend solver integration (Units 47/48) observes
> completion through the existing `GET /solver/status/{id}` polling — no
> frontend change is part of this unit.

## Execution model

The solver pipeline (snapshot → CP-SAT solve → result application) is **Python**
and lives entirely in the backend (`backend/solver/`). A deployed Trigger.dev
worker is a **Node container** with no Python, no backend code, and no database
access, so it cannot run the solver itself.

The `solver-job` task is therefore an **orchestration wrapper** with two
execution paths (`jobs/src/trigger/solverJob.ts`):

| Path                | When                          | How it executes the solver                                   |
| ------------------- | ----------------------------- | ------------------------------------------------------------ |
| **HTTP (prod)**     | `SOLVER_EXECUTE_URL` is set   | POSTs the run reference to the backend `POST /solver/internal/execute`; the backend runs the pipeline and applies the result. |
| **Local spawn (dev)** | `SOLVER_EXECUTE_URL` unset  | Spawns `python -m solver.job_cli` on the same machine (`BACKEND_DIR`/`PYTHON_BIN`). |

In both paths **all solver business logic and result application stay in the
backend**; the task only orchestrates and reports the structured outcome.

End-to-end production flow:

```
Frontend  ──POST /solver/start──▶  Backend (Railway)
                                     │  builds snapshot, creates SolverRun (PENDING)
                                     └─ triggers Trigger.dev task via API (TRIGGER_SECRET_KEY)
Trigger.dev cloud worker  ──POST /solver/internal/execute (Bearer SOLVER_EXECUTE_TOKEN)──▶  Backend
                                     run_solver_job: mark RUNNING → solve → apply result safely
                                                     → record SUCCEEDED / FAILED on the SolverRun row
Frontend  ──GET /solver/status/{id} (polling)──▶  Backend  (observes completion/partial/failure)
```

Status flows back to the frontend through the `SolverRun` database row (written
by `run_solver_job`), not through a webhook — so no inbound callback from
Trigger.dev to the frontend is needed.

## The internal execute endpoint

`POST /solver/internal/execute` (`backend/api/solver.py`):

- **Auth:** the shared `SOLVER_INTERNAL_TOKEN` presented as
  `Authorization: Bearer <token>` — **not** a Supabase admin JWT (the caller is
  a machine, not a logged-in admin). Constant-time comparison; **fails closed
  with `503`** when the token is unset, so the endpoint is never accidentally
  open. Returns `401` on a missing/wrong token.
- **Body (snake_case references only, never draft state):**
  `{ "solver_run_id": "...", "correlation_id": "...", "admin_workspace_id": null, "snapshot_id": null }`
- **Behaviour:** runs `run_solver_job`, which marks the run RUNNING, solves from
  **saved** state, applies the result through the Unit 43 application service
  (which rolls back and leaves saved assignments unchanged on any failure), and
  records the final status. Returns the structured result document.

## Secrets

These are **server-side secrets** and must never be exposed to the frontend
(no `VITE_` variable, never in the client bundle).

### Backend (Railway service variables)

| Variable                 | Required for prod solver | Notes                                                                 |
| ------------------------ | ------------------------ | --------------------------------------------------------------------- |
| `SOLVER_INTERNAL_TOKEN`  | Yes                      | Long random secret (`openssl rand -hex 32`). Authorizes the worker.   |
| `TRIGGER_SECRET_KEY`     | Yes                      | Trigger.dev **production** environment server API key; lets `POST /solver/start` queue the task. |
| `TRIGGER_API_URL`        | No                       | Defaults to `https://api.trigger.dev`.                                |
| `TRIGGER_SOLVER_TASK_ID` | No                       | Defaults to `solver-job`.                                             |

### Trigger.dev (Production environment variables)

Set these in the Trigger.dev dashboard → your project → **Production**
environment → Environment Variables (or via `trigger.dev deploy` env config):

| Variable               | Required | Notes                                                                                  |
| ---------------------- | -------- | -------------------------------------------------------------------------------------- |
| `SOLVER_EXECUTE_URL`   | Yes      | `https://<railway-backend>/solver/internal/execute` — enables the HTTP bridge.         |
| `SOLVER_EXECUTE_TOKEN` | Yes      | **Must equal** the backend's `SOLVER_INTERNAL_TOKEN`.                                   |

The Trigger.dev project ref is set in `jobs/trigger.config.ts` (the `project`
field), not as an env var.

> Note: `BACKEND_DIR` / `PYTHON_BIN` are **local-dev only** and are ignored in
> production once `SOLVER_EXECUTE_URL` is set.

## Manual setup steps (one-time)

These must be performed by a human in the Trigger.dev / Railway dashboards or
CLIs; they cannot be automated from this repository.

1. **Backend prerequisite:** the backend is deployed on Railway and healthy (see
   [railway-deployment.md](./railway-deployment.md)), with migrations at head.
2. **Generate the shared secret:** `openssl rand -hex 32`.
3. **Backend env (Railway):** set `SOLVER_INTERNAL_TOKEN` to that value and
   `TRIGGER_SECRET_KEY` to the Trigger.dev **production** server API key
   (dashboard → Project settings → API keys → Production). Redeploy/restart so
   the backend picks up the new variables.
4. **Authenticate the deploy:** from `jobs/`, set `TRIGGER_ACCESS_TOKEN` (or
   `npm run login`).
5. **Confirm the project ref** in `jobs/trigger.config.ts` matches your
   Trigger.dev project.
6. **Set Trigger.dev production env vars:** `SOLVER_EXECUTE_URL`
   (`https://<railway-backend>/solver/internal/execute`) and
   `SOLVER_EXECUTE_TOKEN` (= `SOLVER_INTERNAL_TOKEN`).
7. **Deploy the worker:** from `jobs/`, `npm run deploy`
   (`trigger.dev deploy`). Confirm `solver-job` and `test-job` register in the
   **Production** environment in the dashboard.
8. **Run the smoke test** (below) and the failure-safety check.

## Production solver smoke test

Use a small known-good dataset (a few rooms, lecturers, units with schedulable
sessions, at least one unscheduled session) created through the deployed
frontend/backend.

1. From the deployed frontend, start a solver run (or
   `POST /solver/start` with a valid admin token). The backend creates a
   `SolverRun` (PENDING) and queues the Trigger.dev task.
2. In the Trigger.dev dashboard (Production), confirm a `solver-job` run starts
   and emits `solver_job_started` with `mode: "backend_http"`.
3. Confirm the backend logs `solver_execute_invoked` then `solver_job_started`
   / `solver_job_completed` for the same `correlation_id`.
4. The task returns a structured result and logs `solver_job_completed`.
5. The frontend observes completion through `GET /solver/status/{id}` polling
   (status `succeeded`, with `scheduled_count` / `unscheduled_count`). A valid
   **partial** result (some sessions unscheduled) is displayed safely through
   the same integration.

Verify the result application wrote saved assignments: reload the timetable and
confirm the newly scheduled sessions are persisted.

## Failure-safety verification

Force or simulate one failed job and confirm saved assignments are unchanged:

- Easiest infra-level check: temporarily set a wrong `SOLVER_EXECUTE_TOKEN` (or
  stop the backend) and start a run — the task returns `failed`
  (`backend_error` / `backend_unreachable`), the `SolverRun` is marked FAILED,
  and **no** saved assignments change.
- Pipeline-level: an integrity/solve/apply failure inside `run_solver_job`
  rolls back via the Unit 43 application service, leaving saved state intact and
  reporting a `failed` status with a concise failure code.

In all cases the previously saved timetable must be byte-for-byte unchanged.

## Logs

Job lifecycle is observable from both sides:

- **Trigger.dev run logs:** `solver_job_started` (with `mode`),
  `solver_job_completed` or `solver_job_failed` (with `failureCode`).
- **Backend logs:** `solver_execute_invoked`, then the `run_solver_job`
  lifecycle (`solver_job_started` / `solver_job_completed` / `solver_job_failed`)
  and `solver_run_*` status updates, all carrying the `correlation_id`.

## Verification checklist

Mirrors the Unit 56 spec:

- [ ] Trigger.dev **production** environment exists for the project.
- [ ] Production secrets configured without exposing them to the frontend
      (`SOLVER_INTERNAL_TOKEN`/`TRIGGER_SECRET_KEY` on the Railway backend;
      `SOLVER_EXECUTE_URL`/`SOLVER_EXECUTE_TOKEN` on Trigger.dev).
- [ ] Solver job worker deployed (`trigger.dev deploy`); `solver-job`
      registered in Production.
- [ ] `POST /solver/start` on the deployed backend triggers the production job.
- [ ] Job lifecycle logs appear for start, completion, and failure.
- [ ] A production smoke run completes successfully or with a valid partial
      result.
- [ ] Solver result application updates saved assignments safely.
- [ ] Frontend observes completion through existing `GET /solver/status/{id}`.
- [ ] A failed job leaves existing saved assignments unchanged.
- [ ] Solver business logic remains outside the Trigger.dev job definition (the
      task only orchestrates / calls the backend).

## Deployed references

_To be filled in after the first production deploy:_

- Trigger.dev project ref: `proj_kwgyhghrnimqdhmwqjrr`
- `SOLVER_EXECUTE_URL`: `https://<railway-backend>/solver/internal/execute`
