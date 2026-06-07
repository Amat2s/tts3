# Unit 5 Spec: Frontend Supabase Auth and Protected Route Shell

## Goal

Add frontend authentication behavior and protect the app routes created earlier. The result should let users sign in and sign out with Supabase Auth, redirect unauthenticated users to `/login`, and send signed-in users to `/timetable`.

## Design

- Keep this unit inside `frontend/`.
- Use the existing login shell, app layout, route shell, and theme from earlier units.
- Protect frontend routes for user experience, while relying on the backend auth boundary from Unit 4 for actual API security.
- Do not connect product pages to backend data yet.
- Keep auth state separate from future timetable/domain state.

## Implementation

### Scope

Build frontend Supabase Auth behavior only.

This unit should include:

- Supabase frontend client;
- sign-in behavior on `/login`;
- sign-out behavior from the app shell;
- session-loading state;
- auth hook, provider, or context;
- protected route wrapper;
- redirect unauthenticated users to `/login`;
- redirect authenticated users to `/timetable` after login.

### Login Behavior

Use the existing `/login` page shell from Unit 2.

The sign-in form should now perform real Supabase email/password sign-in and show clear loading and error states.

Do not add registration, password reset, magic links, or account management unless they are required for basic sign-in.

### Route Protection

Protect the primary app routes:

- `/timetable`
- `/rooms`
- `/lecturers`
- `/students`
- `/units`

Unauthenticated users should not be able to view these route shells.

### Out of Scope

Do not implement:

- authenticated backend API client;
- room, lecturer, student, unit, session, or timetable API calls;
- TanStack Query;
- Zustand;
- CRUD behavior;
- timetable grid data loading;
- solver behavior;
- role-based access;
- student or lecturer user roles;
- mock domain data.

## Dependencies

Install only what this unit first needs:

- Supabase JavaScript client.

Do not install TanStack Query, Zustand, dnd-kit, or feature-specific dependencies yet.

## Verification Checklist

- [ ] `/login` performs real Supabase sign-in.
- [ ] Sign-in shows loading and error states.
- [ ] Signed-in users are redirected to `/timetable`.
- [ ] Sign-out works from the app shell.
- [ ] Unauthenticated users are redirected to `/login` when visiting protected app routes.
- [ ] Auth state is available through a small frontend auth boundary.
- [ ] Product pages remain blank/empty shells with no real data wiring.
- [ ] No authenticated API client has been added yet.
- [ ] No mock room, lecturer, student, unit, session, timetable, or solver data is present.
- [ ] The frontend build command succeeds.
