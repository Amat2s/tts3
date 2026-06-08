# Unit 26 Spec: Frontend Session API Client

## Goal

Add frontend API functions and DTO types for session records. The result should let frontend code fetch, create, update, and delete sessions through the protected backend session API, and fetch schedulable sessions for the future timetable unscheduled-pool flow.

## Design

- Keep this unit inside `frontend/`.
- Build only the session API client layer.
- Use the authenticated API base client from Unit 6.
- Keep session API types separate from unit API types.
- Sessions are still displayed and managed inline inside units; do not introduce standalone session UI concepts.
- DTO types must match the backend response shape from Unit 25.
- Do not wire the `/units` page to persistent session behavior yet.
- Do not store server-owned session data in Zustand.
- Do not add timetable unscheduled-pool integration in this unit.

## Implementation

### Scope

Build frontend session API client support only.

This unit should include:

- session DTO types;
- session create/update request types;
- schedulable-session DTO types;
- API function for listing sessions for a unit;
- API function for creating a session under a unit;
- API function for updating a session;
- API function for deleting a session;
- API function for listing schedulable sessions;
- session-specific API error parsing where useful;
- build-safe exports for later integration units.

### Session DTO Shape

Create a `Session` DTO that matches the backend Unit 25 response.

It should include:

- `id`;
- `unit_id`;
- `session_type`;
- `duration`;
- `created_at`, if returned by backend;
- `updated_at`, if returned by backend.

Use frontend naming that matches backend JSON fields exactly unless the existing API-client convention already transforms response shapes.

### Session Type

Define a constrained frontend union for session types:

- `lecture`;
- `tutorial`;
- `lab`;
- `workshop`.

This type should be reused by session create/update request types.

Do not use free-form strings for persisted session type values.

### Session Create and Update Requests

Create request types for:

- creating a session under a unit;
- updating an existing session.

Create request shape:

- `session_type`;
- `duration`.

Update request shape:

- optional `session_type`;
- optional `duration`.

Do not include `unit_id` in the update request unless the backend explicitly supports moving sessions between units. For v1, sessions should remain under their parent unit.

### Schedulable Session DTO

Create a `SchedulableSession` DTO matching the backend schedulable-session response.

It should include:

- session id;
- unit id;
- unit code;
- unit name;
- session type;
- duration;
- lecturer id;
- lecturer display name;
- student count.

Do not include assignment fields in this DTO yet. Assignment persistence is introduced later.

### API Functions

Create session API functions for:

- `listUnitSessions(unitId)`;
- `createUnitSession(unitId, input)`;
- `updateSession(sessionId, input)`;
- `deleteSession(sessionId)`;
- `listSchedulableSessions()`.

All functions must use the authenticated API base client so Supabase access tokens are attached consistently.

Keep endpoint paths aligned with the backend routes from Unit 25.

### Error Handling

Use the existing API client error behavior for:

- auth errors;
- backend structured errors;
- JSON parsing;
- empty responses.

Add a `parseSessionError` helper only if it improves user-facing error messages for common cases such as:

- invalid session type;
- invalid duration;
- missing unit;
- deleted session.

Do not swallow errors silently.

### Out of Scope

Do not implement:

- TanStack Query page hooks unless that is already the project’s API-client convention;
- `/units` page session integration;
- persistent add-session behavior;
- persistent delete-session behavior;
- timetable unscheduled pool;
- session cards on the timetable;
- manual scheduling;
- drag-and-drop;
- assignment API client;
- constraint validation client;
- solver client;
- mock sessions;
- localStorage session state;
- Zustand session storage.

## Dependencies

No new package should be required.

Use existing frontend dependencies and the authenticated API base client.

## Verification Checklist

- [ ] Session DTO type exists and matches the backend response shape.
- [ ] Session type union exists and matches backend-supported values.
- [ ] Session create request type exists.
- [ ] Session update request type exists.
- [ ] Schedulable-session DTO type exists.
- [ ] `listUnitSessions` API function exists.
- [ ] `createUnitSession` API function exists.
- [ ] `updateSession` API function exists.
- [ ] `deleteSession` API function exists.
- [ ] `listSchedulableSessions` API function exists.
- [ ] All session API functions use the authenticated API base client.
- [ ] API paths match the backend Unit 25 route design.
- [ ] API errors are parsed consistently with existing frontend API behavior.
- [ ] No server-owned session data is stored in Zustand or localStorage.
- [ ] `/units` is not connected to persistent session data yet.
- [ ] No timetable, assignment, drag/drop, constraint, or solver behavior has been added.
- [ ] No mock domain data has been added.
- [ ] The frontend build command succeeds.
