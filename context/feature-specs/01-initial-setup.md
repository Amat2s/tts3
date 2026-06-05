# Unit 1 Spec: Repository, Frontend Bootstrap, and UI Foundation

## Goal

Create the project foundation and a working `frontend/` app. The result should be a Vite + React + TypeScript frontend that runs locally and displays one styled placeholder page using the real v1 theme.

## Design

- Use the project’s light-only academic admin visual direction from `ui-context.md`.
- Configure the global theme early so all future UI work starts from the correct tokens.
- The visible page should prove that React, TailwindCSS, shadcn/ui, and the project styling foundation are working.
- Do not show mock timetable data, mock rooms, mock lecturers, mock students, mock units, fake counts, fake solver states, or placeholder application records.
- A simple structural placeholder is enough, such as an app title, short description, status badge, and one card confirming the frontend foundation is ready.

## Implementation

### Scope

Build the root repository setup and the initial frontend foundation only.

This unit should include:

- root README;
- root `.gitignore`;
- minimal `.env.example` files if useful;
- `docs/` placeholder;
- `frontend/` Vite React TypeScript app;
- TailwindCSS configured for the frontend;
- `globals.css` configured with the project design tokens;
- shadcn/ui initialized;
- the first shared UI components needed for early screens;
- one styled placeholder page.

### Frontend Foundation

Create the `frontend/` application using Vite, React, and TypeScript.

Keep the frontend clean:

- remove the default Vite demo UI;
- do not add routing yet;
- do not add backend/API code yet;
- do not add auth yet;
- do not add app state libraries yet;
- do not add timetable-specific components yet.

The root `App` should render only the styled foundation screen.

### Styling Foundation

Configure TailwindCSS and `globals.css` in this unit because every later frontend unit depends on the styling system.

`globals.css` should define the project CSS variables from `ui-context.md`, including:

- page background;
- surface colors;
- text colors;
- accent colors;
- border colors;
- state colors;
- timetable color tokens;
- unit card color tokens;
- solver accent tokens;
- font variables.

Use light mode only. Do not add a dark-mode theme or toggle.

### shadcn/ui Foundation

Initialize shadcn/ui in this unit and add only the components needed for near-term UI shells:

- `Button`
- `Input`
- `Card`
- `Table`
- `Dialog`
- `Alert`
- `Badge`
- `Select`
- `Form`

Do not customize these into feature-specific components yet.

### Repository Documentation

Add a short root README that explains:

- what the app is;
- that v1 is a single-admin university timetable scheduler;
- how to run the frontend locally;
- where future frontend, backend, and docs code will live.

Do not document backend commands yet unless no backend code is created.

### Out of Scope

Do not implement:

- React Router;
- app navigation;
- login behavior;
- Supabase;
- FastAPI;
- database setup;
- API clients;
- TanStack Query;
- Zustand;
- dnd-kit;
- timetable grid;
- management pages;
- mock domain data;
- solver behavior;
- Trigger.dev;
- deployment config.

## Dependencies

Install only the frontend dependencies needed for this unit:

- Vite React TypeScript baseline dependencies;
- TailwindCSS and its Vite integration;
- shadcn/ui initialization dependencies;
- the shadcn/ui component dependencies required by the selected base components;
- Node type definitions only if needed for Vite path aliases.

Do not install future feature dependencies yet.

## Verification Checklist

- [ ] `frontend/` exists and runs locally.
- [ ] The default Vite demo UI has been removed.
- [ ] The visible page uses the project theme and not generic starter styling.
- [ ] `globals.css` contains the v1 design tokens from `ui-context.md`.
- [ ] shadcn/ui is initialized and the selected base components exist.
- [ ] No mock timetable, room, lecturer, student, unit, session, or solver data is present.
- [ ] No routing, auth, backend, database, API, solver, or job code has been added.
- [ ] The frontend build command succeeds.
- [ ] The README explains how to run the frontend locally.
