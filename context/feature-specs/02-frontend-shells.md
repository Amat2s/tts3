# Unit 2 Spec: Frontend Route Shell, App Layout, and Login Shell

## Goal

Create the frontend navigation and page structure for the app. The result should let a user move between all planned v1 routes and view a complete login screen shell, without implementing authentication or real feature behavior yet.

## Design

- Keep this unit entirely inside `frontend/`.
- Use the existing theme, CSS tokens, and shadcn/ui foundation from Unit 1.
- Build the app shell around a top navigation bar and main content area. Do not add a permanent sidebar in v1.
- All feature pages should be blank or empty-state shells only. Do not use mock rooms, lecturers, students, units, sessions, timetable assignments, solver states, or fake counts.
- The login page should look complete structurally, but it should not authenticate yet.
- The sign-out control should have a clear location in the app shell, but it should not perform real sign-out behavior yet.

## Implementation

### Scope

Build the frontend route and layout foundation only.

This unit should include:

- React Router setup;
- a shared app layout;
- a top navigation shell;
- placeholder pages for all primary v1 routes;
- a `/login` page shell;
- sign-in form fields without real submission behavior;
- loading and error display shells for future auth/data states;
- a visible location for future sign-out behavior.

### Routes

Create these routes:

- `/timetable`
- `/rooms`
- `/lecturers`
- `/students`
- `/units`
- `/login`

Each protected-app route should render a page title, short description, and empty-state content explaining that the page is not connected to data yet.

Do not implement route protection in this unit. Route protection belongs in the later frontend auth unit.

### App Layout

Create reusable layout primitives for:

- top-level app frame;
- top navigation;
- main content area;
- page header;
- simple empty-state section.

The navigation should expose links to:

- Timetable;
- Rooms;
- Lecturers;
- Students;
- Units.

The layout should be reusable by future feature pages without embedding feature-specific logic.

### Login Shell

Create a `/login` page with:

- app/product title;
- short explanation of the admin login purpose;
- email field;
- password field;
- submit button;
- loading state shell;
- error message shell.

The form should not call Supabase yet. It may prevent default browser submission and display no real result.

### Out of Scope

Do not implement:

- Supabase Auth;
- real sign-in;
- real sign-out;
- protected routes;
- API clients;
- backend calls;
- TanStack Query;
- Zustand;
- timetable grid;
- CRUD tables;
- forms for rooms, lecturers, students, units, or sessions;
- mock domain data;
- solver UI behavior.

## Dependencies

Install only what this unit first needs:

- React Router.

Do not install Supabase, TanStack Query, Zustand, dnd-kit, or backend-related dependencies yet.

## Verification Checklist

- [ ] The frontend runs locally.
- [ ] React Router is configured.
- [ ] `/timetable`, `/rooms`, `/lecturers`, `/students`, `/units`, and `/login` render successfully.
- [ ] The top navigation can move between the primary app routes.
- [ ] The app shell uses the Unit 1 theme and shared UI components.
- [ ] The login page displays a complete sign-in form shell.
- [ ] No real authentication behavior has been added.
- [ ] No route protection has been added.
- [ ] No backend calls or API clients have been added.
- [ ] No mock application/domain data is present.
- [ ] The frontend build command succeeds.
