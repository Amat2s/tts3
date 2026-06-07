# Unit 3 Spec: Backend Bootstrap, Database, Migrations, and Error Foundation

## Goal

Create the backend foundation for the application. The result should be a FastAPI backend that runs locally, exposes a health endpoint, can connect to the database, can run migrations, and has a consistent starting point for logging and API errors.

## Design

- Keep this unit entirely inside `backend/`.
- Build only infrastructure that later backend features will depend on.
- Do not create domain models yet. Rooms, lecturers, students, units, sessions, assignments, constraints, and solver logic all belong to later units.
- Use a small, predictable backend folder structure so future routers, schemas, services, auth helpers, and database models have obvious homes.
- The backend should be safe to run locally even before any real app data exists.

## Implementation

### Scope

Build the backend application foundation only.

This unit should include:

- FastAPI app entrypoint;
- basic API router structure;
- health check endpoint;
- CORS configuration for the local frontend;
- environment/config loading;
- SQLAlchemy 2.0 database engine/session setup;
- database dependency helper;
- Alembic setup;
- first empty migration;
- basic structured logging setup;
- shared API error response primitives.

### Backend Structure

Create a clear backend structure for future units, such as:

- `backend/api/`
- `backend/db/`
- `backend/models/`
- `backend/schemas/`
- `backend/services/`
- `backend/auth/`
- `backend/logging/`

Only add files that are needed for the backend to start cleanly, connect to the database, run migrations, and return basic responses.

### Health and Error Foundation

Add a simple health route that can be used to confirm the backend is running.

Add shared error primitives, but do not overbuild feature-specific errors yet. This unit only needs the base shape future API routes will follow.

### Database and Migrations

Configure SQLAlchemy and Alembic so later units can add models and migrations cleanly.

The first migration should be a baseline migration only. It should not create domain tables.

### Out of Scope

Do not implement:

- Supabase Auth verification;
- protected routes;
- room, lecturer, student, unit, session, or assignment models;
- CRUD endpoints;
- constraint validation;
- solver code;
- Trigger.dev jobs;
- frontend API clients;
- mock domain data;
- seed data.

## Dependencies

Install only backend foundation dependencies needed in this unit, such as:

- FastAPI;
- Uvicorn or another local ASGI runner;
- Pydantic settings/config support if needed;
- SQLAlchemy 2.0;
- Alembic;
- a Postgres driver;
- structured logging dependency if used.

Do not install Supabase Auth, OR-Tools, Trigger.dev, or feature-specific libraries yet.

## Verification Checklist

- [ ] The backend starts locally.
- [ ] The health endpoint responds successfully.
- [ ] CORS allows local frontend development.
- [ ] Database configuration loads from environment variables.
- [ ] SQLAlchemy session setup exists.
- [ ] Alembic is configured.
- [ ] The first empty migration can run.
- [ ] Basic structured logging exists.
- [ ] API error primitives exist.
- [ ] No domain models or CRUD routes have been added.
- [ ] No auth, constraints, solver, jobs, or frontend API wiring has been added.
