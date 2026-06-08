# Unit 10 Spec: Frontend Room API Client

## Goal

Add frontend API functions and types for the protected room API. The result should let frontend code call the backend room endpoints through the authenticated API base client without wiring the rooms page UI yet.

## Design

- Keep this unit inside `frontend/`.
- Build on the authenticated API base client from Unit 6.
- Match the backend room DTO shapes from Unit 9 exactly.
- Keep room API code centralized so the rooms page and timetable page can reuse the same source of truth.
- Do not introduce TanStack Query or page-level integration yet.

## Implementation

### Scope

Build the frontend room API client only.

This unit should include:

- room DTO types;
- create-room input type;
- update-room input type;
- room API functions;
- room-specific error handling where useful;
- a small developer-verifiable call path if needed.

### API Client Location

Add room API code under the existing frontend API area, likely `src/lib/api/`.

Keep the room client separate from the generic request helper. The generic helper should remain product-agnostic; room-specific paths, DTOs, and request bodies belong in the room API module.

### Room Types

Define TypeScript types that match the backend response shapes.

Include only real backend-supported fields, such as:

- `id`;
- `name`;
- `capacity`;
- `roomType` or the actual serialized backend field name;
- timestamps if returned by the backend.

Keep DTO types separate from future UI view models if any transformation becomes necessary.

Do not use `any` for API responses.

### API Functions

Add functions for:

- listing rooms;
- creating a room;
- updating a room;
- deleting a room.

Each function should use the authenticated API base client so the Supabase access token is attached consistently.

Function names should be predictable and reusable by TanStack Query hooks in the next unit.

### Error Handling

Use the shared API error parsing from Unit 6.

Add room-specific interpretation only if it helps the future UI show clearer messages, such as duplicate room name or validation failure messages returned by the backend.

Do not hide backend errors silently.

### Out of Scope

Do not implement:

- TanStack Query setup;
- rooms page data fetching;
- create/edit/delete mutations from UI;
- timetable room integration;
- room forms beyond what already exists from the shell unit;
- mock room data;
- localStorage persistence;
- Zustand room state.

## Dependencies

No new package should be required.

Do not install TanStack Query in this unit unless it has already been added elsewhere and is required by the existing codebase.

## Verification Checklist

- [ ] Room DTO types match the backend room API response shape.
- [ ] Create and update input types exist.
- [ ] Room API functions exist for list, create, update, and delete.
- [ ] Room API functions use the authenticated API base client.
- [ ] Room API functions attach auth through the shared client rather than manually duplicating token logic.
- [ ] API errors use the shared error normalization path.
- [ ] No TanStack Query integration has been added.
- [ ] The rooms page is not connected to real data yet.
- [ ] No mock room records or local persistence have been added.
- [ ] The frontend build command succeeds.
