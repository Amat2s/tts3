# Unit 32 Spec: Frontend Assignment API Client

## Goal

Add frontend API functions and DTO types for timetable assignments. The result should let frontend code list assignments, schedule a session, move a scheduled session, and unschedule a session through the protected backend assignment API.

## Design

- Keep this unit inside `frontend/`.
- Build only the assignment API client layer.
- Use the authenticated API base client from Unit 6.
- Keep assignment API types separate from session, unit, room, constraint, and solver types.
- Do not wire assignment behavior into the timetable page yet.
- Do not store server-owned assignment data in Zustand.
- Do not add drag-and-drop behavior in this unit.
- DTO types must match the backend response shape from Unit 31.

## Implementation

### Scope

Build frontend assignment API client support only.

This unit should include:

- assignment DTO types;
- schedule request type;
- move request type;
- assignment list API function;
- schedule session API function;
- move assignment API function;
- unschedule assignment API function;
- assignment-specific API error parsing where useful;
- build-safe exports for later timetable integration units.

### Assignment DTO Shape

Create an `Assignment` DTO matching the backend Unit 31 response.

It should include:

- `id`;
- `session_id`;
- `room_id`;
- `day`;
- `start_slot`;
- `created_at`, if returned by backend;
- `updated_at`, if returned by backend.

If the backend response includes nested display data, represent it explicitly with typed nested DTOs rather than `any`.

Possible nested display data:

- session summary;
- unit summary;
- room summary.

Do not invent nested fields that the backend does not return.

### Day and Slot Types

Define constrained frontend unions for timetable assignment values.

Days:

- `Monday`;
- `Tuesday`;
- `Wednesday`;
- `Thursday`;
- `Friday`.

Slots:

- `s1`;
- `s2`;
- `s3`;
- `s4`;
- `s5`;
- `s6`;
- `s7`.

These types should align with the timetable grid and backend assignment schema.

### Schedule Request

Create a schedule request type with:

- `session_id`;
- `room_id`;
- `day`;
- `start_slot`.

This request is used to place an unscheduled session onto the timetable.

### Move Request

Create a move request type with:

- `room_id`;
- `day`;
- `start_slot`.

This request is used to move an existing assignment.

Do not include `session_id` in the move request unless the backend route explicitly requires it. The assignment id identifies the scheduled session being moved.

### API Functions

Create assignment API functions for:

- `listAssignments()`;
- `scheduleSession(input)`;
- `moveAssignment(assignmentId, input)`;
- `unscheduleAssignment(assignmentId)`.

All functions must use the authenticated API base client so Supabase access tokens are attached consistently.

Keep endpoint paths aligned with the backend routes from Unit 31.

### Error Handling

Use the existing API client error behavior for:

- auth errors;
- backend structured errors;
- JSON parsing;
- empty responses.

Add a `parseAssignmentError` helper only if it improves user-facing messages for common cases such as:

- session already scheduled;
- missing session;
- missing room;
- invalid day;
- invalid slot;
- deleted assignment.

Do not swallow errors silently.

### Out of Scope

Do not implement:

- TanStack Query page hooks unless that is already the established API-client convention;
- timetable page assignment integration;
- scheduled session rendering;
- manual scheduling UI;
- drag-and-drop scheduling;
- optimistic assignment updates;
- assignment data in Zustand or localStorage;
- constraint validation client;
- solver client;
- mock assignments.

## Dependencies

No new package should be required.

Use existing frontend dependencies and the authenticated API base client.

## Verification Checklist

- [ ] Assignment DTO type exists and matches the backend response shape.
- [ ] Day union exists and matches the timetable grid.
- [ ] Slot union exists and uses `s1`–`s7`.
- [ ] Schedule request type exists.
- [ ] Move request type exists.
- [ ] `listAssignments` API function exists.
- [ ] `scheduleSession` API function exists.
- [ ] `moveAssignment` API function exists.
- [ ] `unscheduleAssignment` API function exists.
- [ ] All assignment API functions use the authenticated API base client.
- [ ] API paths match the backend Unit 31 route design.
- [ ] API errors are parsed consistently with existing frontend API behavior.
- [ ] No server-owned assignment data is stored in Zustand or localStorage.
- [ ] The timetable page is not connected to assignment data yet.
- [ ] No drag/drop, constraint, solver, or mock assignment behavior has been added.
- [ ] The frontend build command succeeds.
