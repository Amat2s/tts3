# University Timetable Scheduler

Single-admin university timetable scheduling system (v1).

The admin creates rooms, lecturers, students, units, and sessions, then manually schedules them onto a weekly timetable grid or runs a constraint solver to schedule unscheduled sessions automatically. The solver uses hard constraints (lecturer conflicts, student conflicts, room capacity, lecturer availability, room double-booking) and leaves invalid placements visible rather than blocking them.

## Repository Layout

```
frontend/   React (Vite + TypeScript) single-page application
backend/    FastAPI backend — data persistence, constraint evaluation, solver orchestration
docs/       Project documentation
```

## Running the Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173` by default.

To build for production:

```bash
npm run build
```

## Status

v1 is under active development. Backend, database, and solver code are not yet implemented.
