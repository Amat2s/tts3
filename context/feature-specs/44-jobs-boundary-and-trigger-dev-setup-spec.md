# Unit 44 Spec: Jobs Boundary and Trigger.dev Setup

## Goal

Add the jobs boundary and minimal Trigger.dev setup needed to run backend work outside request handlers. The result should prove that a basic job can be registered and executed without placing solver business logic inside the job definition.

## Design

- Keep this unit inside `jobs/` and any minimal backend configuration needed to support it.
- Install Trigger.dev only in this unit.
- The job boundary should orchestrate work, not contain solver logic.
- Do not wire the production solver job yet.
- Do not add frontend behavior in this unit.
- Keep environment variables explicit and documented.

## Implementation

### Scope

Build Trigger.dev setup only.

This unit should include:

- Trigger.dev dependency and configuration;
- `jobs/` directory structure if not already present;
- minimal job registration;
- local development command documentation;
- environment variable examples;
- basic structured logging from a test job;
- no solver execution logic.

### Jobs Boundary

Create a clear jobs boundary for future solver orchestration.

The structure should make it obvious that:

- jobs receive input references or small payloads;
- jobs call backend services for real business logic;
- jobs do not directly implement CP-SAT modeling;
- jobs do not directly manipulate frontend draft state;
- jobs do not bypass backend assignment result application services.

### Minimal Test Job

Add a basic job that can be run locally and logs completion.

The test job may accept a simple payload such as:

- message;
- correlation id;
- timestamp.

It should not:

- query timetable data;
- build solver input;
- run OR-Tools;
- write assignment results.

### Environment and Commands

Document only what is needed to run jobs locally.

Include:

- required Trigger.dev env vars;
- local dev command;
- how this differs from running FastAPI;
- note that solver job wiring comes later.

### Out of Scope

Do not implement:

- async solver job;
- solver start/status API;
- frontend solver client;
- solver polling;
- result persistence through jobs;
- production deployment wiring;
- frontend UI changes.

## Dependencies

This unit depends on:

- Unit 43 backend solver result application service.

Install Trigger.dev packages according to the project’s selected Trigger.dev version.

## Verification Checklist

- [ ] `jobs/` boundary exists.
- [ ] Trigger.dev dependency is installed and configured.
- [ ] Required env vars are documented.
- [ ] A minimal test job is registered.
- [ ] The test job can run and log completion.
- [ ] Job code contains no solver business logic.
- [ ] Job code does not query or mutate timetable assignments.
- [ ] Local job dev command is documented.
- [ ] No solver start/status API has been added.
- [ ] No frontend solver behavior has been added.
