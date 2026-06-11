# Unit 40 Spec: Frontend Constraint API Client

## Goal

Add frontend API functions and DTO types for constraint validation. The result should let frontend code request authoritative hard constraint violations from the backend without wiring the data into the UI yet.

## Design

- Keep this unit inside `frontend/`.
- Build only the constraint API client layer.
- Use the authenticated API base client.
- Keep constraint types separate from assignment, session, and solver types.
- DTOs should match the backend Unit 39 response shape.
- Do not add timetable page integration in this unit.
- Do not store server-owned validation data in Zustand or localStorage.

## Implementation

Create frontend DTO types for:

- constraint validation response;
- violation object;
- violation type;
- severity;
- affected session ids;
- affected room id where relevant;
- affected lecturer id where relevant;
- affected student ids where relevant;
- human-readable message.

Add an API function such as:

- `validateTimetable()`

The function should call the protected backend validation endpoint from Unit 39 through the shared authenticated API client.

Add constraint-specific error parsing only where it improves user-facing messages.

## Dependencies

No new package should be required.

This unit depends on:

- Unit 6 authenticated API base client;
- Unit 39 backend constraint validation API;
- Unit 36 frontend constraint display shell.

## Verification Checklist

- [ ] Constraint validation response DTO exists.
- [ ] Violation DTO exists and matches backend shape.
- [ ] `validateTimetable` API function exists.
- [ ] API function uses the authenticated API base client.
- [ ] API path matches the backend Unit 39 route.
- [ ] No timetable page integration is added.
- [ ] No validation data is stored in Zustand or localStorage.
- [ ] No mock violations are added.
- [ ] The frontend build command succeeds.
