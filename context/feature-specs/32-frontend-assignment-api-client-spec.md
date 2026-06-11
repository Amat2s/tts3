# Unit 32 Spec: Frontend Assignment API Client

## Goal

Add frontend API functions and DTO types for loading and saving saved timetable assignments. The result should let frontend code load the current saved timetable and persist a complete assignment draft only when the admin clicks save.

## Design

- Keep this unit inside `frontend/`.
- Use the authenticated API base client.
- Do not mutate the backend on every placement, move, or drag/drop.
- Keep assignment API types aligned with the backend Unit 31 response.
- Keep API client code separate from frontend draft-state logic.

## Implementation

### Scope

Build:

- saved assignment DTO types;
- save assignment request types;
- `listAssignments()` API function;
- `saveAssignments(input)` API function;
- optional `clearAssignments()` API function if Unit 31 supports it;
- assignment-specific error parsing.

### DTOs

The loaded assignment DTO should include the fields needed by scheduled-session rendering:

- assignment id;
- session id;
- unit id;
- unit code;
- unit name;
- session type;
- duration;
- lecturer display name;
- student count;
- day;
- start slot;
- room id.

The save request should submit the minimum canonical assignment data:

- session id;
- day;
- start slot;
- room id.

### Error Handling

Handle defensive backend save rejections as save errors, not as normal validation UX. The normal blocked/warning feedback will be implemented in frontend validation units.

## Dependencies

No new package should be required.

## Verification Checklist

- [ ] Assignment DTO type exists.
- [ ] Save request type exists.
- [ ] List assignments API function exists.
- [ ] Save assignments API function exists.
- [ ] API calls use authenticated base client.
- [ ] No frontend draft state has been added.
- [ ] No drag/drop or validation logic has been added.
