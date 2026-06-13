# Jobs (Trigger.dev)

Background jobs boundary for running backend work outside of FastAPI
request handlers. This is a standalone Node/TypeScript project (Trigger.dev
is Node-based) and sits alongside `frontend/` and `backend/` as a top-level
system boundary.

## Boundary rules

Jobs are **orchestration wrappers**, not business logic:

- Jobs receive small payloads or input references (e.g. a snapshot id),
  never mutable frontend draft state.
- Jobs call backend services for real business logic.
- Jobs do **not** directly implement CP-SAT modeling.
- Jobs do **not** directly manipulate frontend draft state.
- Jobs do **not** bypass backend assignment result application services.

The `test-job` proves a job can be registered, run locally, and emit
structured logs. The `solver-job` (Unit 45) is the async solver job: it
orchestrates the backend solver pipeline but contains **no** solver business
logic itself.

## Project layout

```
jobs/
  trigger.config.ts         # Trigger.dev project config (set `project` ref here)
  src/trigger/testJob.ts    # minimal registered test job
  src/trigger/solverJob.ts  # async solver job (orchestration wrapper)
  .env.example              # required env vars
```

## Async solver job (`solver-job`)

`src/trigger/solverJob.ts` runs the solver flow asynchronously, outside the
FastAPI request handlers. It is an **orchestration wrapper**: it owns the job
lifecycle (logging, timing, structured result) and delegates all business
logic to the backend Python solver services by invoking
`python -m solver.job_cli`, which runs:

```
build_solver_input_snapshot   (Unit 41 — reads SAVED database state)
  -> solve_timetable          (Unit 42 — CP-SAT)
  -> apply_solver_result      (Unit 43 — persists generated placements)
```

Key properties:

- The job is driven by a small **payload reference**
  (`solverRunId`, `correlationId`, optional `adminWorkspaceId` / `snapshotId`),
  never mutable frontend draft assignment state.
- The solver runs only from **saved** timetable state.
- On failure the backend leaves saved assignments unchanged; the job reports a
  `failed` status with a concise failure code and message.
- It returns structured result metadata (status, solver status, sessions
  attempted/scheduled/unscheduled, partial flag, duration) suitable for the
  later solver status API.

The job has two execution paths (see `.env.example`):

- **Production — HTTP bridge (Unit 56):** when `SOLVER_EXECUTE_URL` is set, the
  task POSTs the run reference to the deployed backend's
  `POST /solver/internal/execute` endpoint (authorized with
  `SOLVER_EXECUTE_TOKEN`). The backend runs the pipeline and applies the result;
  the worker needs no Python. This is the only path that works in a deployed
  Trigger.dev worker (a Node container with no Python). See
  [docs/trigger-dev-deployment.md](../docs/trigger-dev-deployment.md).
- **Local development — Python spawn bridge (Unit 45):** when
  `SOLVER_EXECUTE_URL` is not set, the task invokes `python -m solver.job_cli`
  on the same machine, configured via `BACKEND_DIR` and `PYTHON_BIN`. It needs
  the backend environment (`backend/.env` with `DATABASE_URL`) available, since
  it reads saved data.

Trigger the solver job from the dashboard "Test" tab with a payload such as:

```json
{
  "solverRunId": "run-0001",
  "correlationId": "dev-0001"
}
```

## Required environment

| Variable                | When needed                                   |
| ----------------------- | --------------------------------------------- |
| `project` ref (config)  | Always — set in `trigger.config.ts`           |
| `TRIGGER_ACCESS_TOKEN`  | Non-interactive auth (CI/deploy); optional for local if you `login` |
| `TRIGGER_SECRET_KEY`    | When a backend service triggers tasks via the API (the backend's key, not set here) |
| `SOLVER_EXECUTE_URL`    | Production: deployed backend internal execute endpoint URL (enables the HTTP bridge) |
| `SOLVER_EXECUTE_TOKEN`  | Production: shared secret = backend `SOLVER_INTERNAL_TOKEN`     |
| `BACKEND_DIR` / `PYTHON_BIN` | Local dev only — Python spawn bridge (ignored when `SOLVER_EXECUTE_URL` is set) |

Copy `.env.example` to `.env` and fill in as needed.

## Local development

From the `jobs/` directory:

```bash
npm install          # install Trigger.dev SDK + CLI
npm run login        # one-time interactive auth (or set TRIGGER_ACCESS_TOKEN)
npm run dev          # start the Trigger.dev dev server; registers tasks
```

`npm run dev` connects to Trigger.dev, watches `src/trigger/`, and registers
every exported `task`. Trigger the test job from the Trigger.dev dashboard
"Test" tab using a payload such as:

```json
{
  "message": "hello from local dev",
  "correlationId": "dev-0001",
  "timestamp": "2026-06-12T00:00:00.000Z"
}
```

The run completes and emits `test_job_started` / `test_job_completed`
structured logs visible in the dashboard run view.

## How this differs from running FastAPI

- FastAPI (`uvicorn main:app --reload`, run from `backend/`) serves the
  synchronous REST API and request/response work.
- The Trigger.dev dev server (`npm run dev`, run from `jobs/`) runs
  **background** tasks outside request handlers. It does not serve HTTP for
  the app; it registers and executes jobs.
- They are separate processes. Nothing in the FastAPI app depends on the
  jobs dev server being up in this unit.

## Production deployment

Deploy the worker with `npm run deploy` (`trigger.dev deploy`). The production
environment, secrets (`SOLVER_EXECUTE_URL`, `SOLVER_EXECUTE_TOKEN`), the smoke
test, and failure-safety verification are documented in
[docs/trigger-dev-deployment.md](../docs/trigger-dev-deployment.md).
