# Unit 12/2 Spec: Timetable Table UI Adjustments

## Goal

Refine the timetable table presentation after room data integration. The result should improve time-slot labels, column sizing, and text interaction behavior without changing timetable functionality, backend data flow, scheduling behavior, or room integration.

## Design

- Keep this unit inside `frontend/`.
- Treat this as a UI-only refinement to the timetable grid built in Units 8 and 12.
- Preserve all existing timetable behavior:
  - no-room state;
  - room-based grid rendering;
  - real room data from the backend;
  - blank cell rendering;
  - current page layout and theme.
- The timetable should always use the full horizontal space available to it.
- Timetable columns should resize proportionally based on the number of rooms. More rooms should make each room column narrower, but the grid itself should remain the same overall width.
- Do not introduce horizontal scrolling for the timetable grid in this unit.
- Timetable text should behave like fixed interface chrome, not selectable document text.

## Implementation

### Scope

Update the timetable table/grid UI only.

This unit should include:

- updated time-slot labels;
- responsive room column sizing;
- removal of horizontal timetable scrolling if present;
- non-selectable timetable text treatment;
- prevention of right-click/context-menu interaction on timetable column/header text where appropriate.

### Time-Slot Labels

Update the visible time labels so each slot shows both the start and end time.

Rules:

- Use 12-hour time.
- Do not show `am` or `pm`.
- Use the format `9:00-9:50`.
- Each teaching slot is a 1-hour block, but the visible teaching period ends 50 minutes after the slot starts.
- Lunch is 1.5 hours.
- Slot one starts at `9:00`.
- Labels should continue sequentially through the existing timetable day structure.

Expected visible pattern:

- `9:00-9:50`
- `10:00-10:50`
- `11:00-11:50`
- `12:00-12:50`
- lunch break as the existing lunch divider/block
- `1:30-2:20`
- `2:30-3:20`
- `3:30-4:20`
- `4:30-5:20`

Do not change the underlying slot IDs or scheduling semantics unless they are currently tied directly to display labels and need a small display-only separation.

### Column Sizing

Update the timetable layout so room columns are not fixed-width.

Required behavior:

- The timetable should fill the full width available from its parent container.
- Room columns should distribute across the available width.
- Adding more rooms should make columns narrower instead of expanding the table width.
- The timetable should not require or show horizontal scrolling.
- Day and room headers should remain aligned with timetable cells.
- The grid should remain readable and structurally consistent even when multiple rooms exist.

Prefer a layout approach that makes the grid width predictable, such as CSS grid fractional columns or table layout rules, instead of hardcoded pixel widths.

### Text Interaction

Prevent normal mouse text interaction with timetable column/header text.

Required behavior:

- Users should not be able to select timetable header/column text while interacting with the grid.
- Right-click/context-menu behavior should be disabled for timetable header/column text where it interferes with the intended app-like interaction model.
- This should apply only to timetable grid chrome, such as day headers, room headers, time labels, and static cell labels.
- Do not globally disable selection or right-click across the whole app.
- Do not block future drag/drop or manual scheduling interactions.

Use focused CSS and event handling only where needed. Avoid broad document-level listeners.

### Out of Scope

Do not implement:

- new timetable functionality;
- backend changes;
- API changes;
- room CRUD changes;
- assignment scheduling;
- drag-and-drop behavior;
- manual placement behavior;
- solver behavior;
- constraint validation;
- mock timetable data;
- new time-slot persistence rules;
- changing the number of timetable slots;
- responsive mobile redesign.

## Dependencies

No new package should be installed for this unit.

Use existing React, TypeScript, TailwindCSS, and project styling primitives.

## Verification Checklist

- [ ] Time-slot labels show start and end times in the format `9:00-9:50`.
- [ ] Teaching slot end labels are 50 minutes after their start labels.
- [ ] The lunch break remains represented as the existing 1.5-hour break/divider.
- [ ] Labels use 12-hour time without `am` or `pm`.
- [ ] Slot one starts at `9:00`.
- [ ] The timetable fills the full available width.
- [ ] Room columns resize to share the available width.
- [ ] Adding rooms does not increase the overall timetable width.
- [ ] The timetable does not show or require horizontal scrolling.
- [ ] Day headers, room headers, and cells remain aligned.
- [ ] Timetable header/column text cannot be selected with the mouse.
- [ ] Right-click/context-menu behavior is disabled only on relevant timetable grid chrome.
- [ ] Global app text selection and right-click behavior are not disabled.
- [ ] No backend, API, scheduling, solver, auth, or room persistence behavior changed.
- [ ] No mock timetable, assignment, session, or solver data was added.
- [ ] The frontend build command succeeds.
