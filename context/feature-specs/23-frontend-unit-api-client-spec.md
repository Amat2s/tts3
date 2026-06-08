# Unit 23 Spec: Frontend Unit API Client

## Goal

Add frontend API functions and DTO types for unit records. The result should let frontend code call the protected backend unit API with the authenticated API client, without wiring the `/units` page to real data yet.

## Design

- Keep this unit inside `frontend/`.
- Build only the unit API client layer.
- Unit DTOs must match the backend response shape from Unit 22.
- Keep unit types separate from future session DTOs. Sessions get their own API client in the later session unit.
- Do not store server-owned unit data in Zustand.
- Do not connect the `/units` route UI to real data in this unit.

## Implementation

### Scope

Build frontend unit API client support only.

This unit should include:

- Unit DTO types;
- create/update request types;
- unit list API function;
- unit create API function;
- unit update API function;
- unit delete API function;
- unit-specific API error parsing where needed;
- a small dev/test-safe way to prove the client can call the protected unit API.

### Unit DTO Shape

Represent the fields currently used by the unit shell and backend unit API:

- internal unit record id;
- unit code, such as `HIS101`;
- unit name, such as `Ancient History`;
- lecturer id and any backend-provided lecturer display data;
- student ids and any backend-provided student display data;
- timestamps if returned by the backend.

Do not include session arrays in the unit DTO unless the backend Unit 22 response explicitly returns them. Session records are introduced through the later session API.

### API Client Behavior

Use the authenticated API base client from Unit 6 so Supabase access tokens are attached consistently.

Keep endpoint paths aligned with the backend unit routes. Do not invent alternative route names in the frontend.

API functions should return typed data and let page-level code handle loading, success, and error states in the later integration unit.

### Out of Scope

Do not implement:

- TanStack Query hooks for page integration unless the project already keeps API hooks with client functions by convention;
- `/units` page real data wiring;
- create/edit/delete UI behavior;
- lecturer selector data fetching;
- student selector data fetching;
- session API client;
- session persistence;
- timetable integration;
- solver behavior;
- mock unit, lecturer, student, or session data.

## Dependencies

No new package should be required.

Use the authenticated API client and frontend patterns already introduced in earlier units.

## Verification Checklist

- [ ] Unit DTO types exist and match the backend Unit 22 API shape.
- [ ] Unit create/update request types exist.
- [ ] Unit list, create, update, and delete API functions exist.
- [ ] API functions use the authenticated API base client.
- [ ] Unit API errors are parsed consistently with existing API client behavior.
- [ ] No server-owned unit data is stored in Zustand.
- [ ] The `/units` page is not connected to real data yet.
- [ ] No session API client or session persistence behavior has been added.
- [ ] No mock domain data has been added.
- [ ] The frontend build command succeeds.
