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

The backend bridge (`solver.job_cli`) is configured via `BACKEND_DIR` and
`PYTHON_BIN` (see `.env.example`). It needs the backend environment
(`backend/.env` with `DATABASE_URL`) available, since it reads saved data.

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
| `TRIGGER_SECRET_KEY`    | Only when a backend service triggers tasks via the SDK (future) |

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

## Not yet implemented (future units)

- Solver start/status API and frontend solver client/polling/UI integration.
- Production Trigger.dev deployment wiring (the `solver-job` bridge currently
  shells out to a local backend interpreter for dev verification).
