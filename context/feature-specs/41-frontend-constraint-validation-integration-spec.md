# Unit 41 Spec: Frontend Constraint Validation Integration

## Goal

Connect the timetable page to real backend constraint validation. The result should show authoritative hard constraint violations, highlight affected scheduled sessions, and refresh validation after scheduling changes.

## Design

- Keep this unit in the frontend/backend connection boundary.
- Use the display shell from Unit 36.
- Use the constraint API client from Unit 40.
- Backend validation is authoritative.
- Invalid placements should remain visible and highlighted.
- Do not block manual scheduling or drag-and-drop in this unit.
- Do not add solver UI or solver behavior yet.
- Do not create fake violation data.

## Implementation

Update `/timetable` to fetch validation results with TanStack Query.

Validation should refresh after timetable-changing mutations, including:

- schedule session;
- move assignment;
- unschedule assignment;
- drag-and-drop schedule;
- drag-and-drop move.

Render validation results in the existing timetable validation UI:

- summary status;
- violation alert or list;
- violation detail surface;
- affected scheduled card highlighting.

A scheduled session should be marked invalid if its assignment/session id appears in one or more violations.

Show clear loading and error states for validation fetches.

If no violations exist, show a neutral or success validation state.

## Dependencies

No new package should be required.

This unit depends on:

- Unit 36 frontend constraint display shell;
- Unit 39 backend constraint validation API;
- Unit 40 frontend constraint API client;
- assignment and drag/drop integration units.

## Verification Checklist

- [ ] `/timetable` fetches real backend validation results.
- [ ] Validation status appears in the timetable action area.
- [ ] Real violations are listed or summarized.
- [ ] Affected scheduled sessions are highlighted.
- [ ] Validation refreshes after schedule, move, unschedule, and drag/drop operations.
- [ ] Empty/no-violation state is visible.
- [ ] Validation fetch errors are visible.
- [ ] Invalid placements remain visible rather than being silently changed.
- [ ] No fake violations are added.
- [ ] No solver behavior is added.
- [ ] The frontend build command succeeds.
