# Project Overview

## Overview

This application is a university timetable scheduling system for administrators. The admin manually creates rooms, lecturers, students, units, and sessions, then uses a timetable workspace to manually place sessions or run a constraint solver to schedule the remaining unscheduled sessions. The system uses fixed weekly time slots, room-based timetable columns, and frontend-owned validation rules to block impossible placements, warn about allowed conflicts, and prevent solver execution when any issue exists. In v1, the application is focused on a single admin creating and managing one timetable, with no student or lecturer-facing views.

## Goals

1. Build a timetable scheduling workspace where an admin can view, edit, and generate a weekly university timetable.
2. Allow the admin to manually create the core scheduling data: rooms, lecturers, students, units, and sessions.
3. Treat sessions as the atomic schedulable blocks used by the constraint solver.
4. Represent the timetable as a fixed weekly grid with Monday to Friday columns, rooms nested under each day, and time slots as rows.
5. Allow unscheduled sessions to be dragged onto the timetable manually.
6. Allow scheduled sessions to be moved within the timetable or removed back to the unscheduled pool.
7. Block impossible manual placements in the frontend before they enter the timetable draft.
8. Allow warning-level conflicts to remain visible while blocking solver execution.
9. Use the solver to schedule as many unscheduled sessions as possible while respecting all locked scheduled sessions.
10. Keep v1 focused on hard constraints only, with soft constraints deferred to v2.
11. Allow the admin to reserve room-specific timetable cells as hard blocks (e.g. chapel, mass, staff meeting, maintenance) that no session may occupy manually or via the solver.

## Core User Flow

1. The admin signs in.
2. The admin lands on `/timetable`.
3. If no rooms exist, the timetable canvas is not shown. The page displays a message telling the admin to add rooms to generate the timetable canvas.
4. The admin uses the top navigation bar to move between:
   - `/timetable`
   - `/preferences`
   - `/units`
   - `/lecturers`
   - `/students`
   - `/rooms`
5. The admin manually creates rooms on `/rooms`.
6. Once at least one room exists, `/timetable` renders the timetable grid.
7. The admin manually creates lecturers on `/lecturers`, including lecturer availability.
8. The admin manually creates students on `/students`.
9. The admin manually creates units on `/units`.
10. Inside each unit, the admin creates sessions.
11. A session becomes schedulable when it has:
    - a unit
    - a Lecture or Tutorial type
    - a session-level lecturer from the unit's teaching team
    - a duration
12. Hidden session-student allocations are rebuilt from unit enrolment. Lectures include every enrolled student; tutorials divide enrolled students into balanced, stable groups. A zero-allocation session has no student-conflict constraints.
13. Schedulable sessions appear underneath the timetable grid in the unscheduled pool.
14. The unscheduled pool groups sessions by unit.
15. The admin can drag an unscheduled session onto the timetable grid.
16. Manual scheduling changes update a frontend timetable draft first.
17. Blocking placement rules reject impossible placements immediately: room duplication, room too small, crossing lunch, and running off the timetable.
18. Warning-level conflicts are allowed to remain scheduled but are visibly flagged.
19. Warning-level conflicts include session-lecturer conflicts, allocated-student conflicts, lecturer availability conflicts, and other non-blocking conflicts represented by current data.
20. The admin explicitly saves the timetable draft to persist assignment results to the database.
21. While any frontend validation issue exists, the solver button is disabled.
22. Once no frontend validation issues exist, the admin can run the solver.
23. While the solver is running, editing is disabled.
24. The solver runs against the saved timetable state.
25. Saved scheduled sessions are treated as fixed inputs to the solver.
26. The solver attempts to schedule all remaining unscheduled sessions.
27. Sessions successfully scheduled by the solver are placed onto the timetable and become saved scheduled assignments.
28. Sessions the solver cannot place remain in the unscheduled pool.
29. If the solver returns a partial result, the UI shows a warning and leaves failed sessions visible below the timetable.
30. The admin can continue manually adjusting the timetable after the solver finishes.

## Features

### Timetable Workspace

- Main workspace at `/timetable`.
- Weekly timetable grid for Monday to Friday.
- Each day contains room columns.
- Each row is a fixed time slot.
- Each grid cell is identified by day, time slot, and room.
- Session duration controls how many vertical time-slot rows the session spans.
- If no rooms exist, the timetable grid does not render.
- If rooms exist but no schedulable sessions exist, the grid renders and the unscheduled area displays an empty-state message.
- The `/timetable` page shows no page header or description between the navbar and the sticky action bar.
- All timetable feedback (save state, solver state, blocking/warning messages, and validation details) lives in one sticky action bar that does not shift the page; details open as an anchored overlay above the timetable.
- The unscheduled pool shows fixed-width unit boxes that wrap across the page; its search matches unit code/name and teaching-team lecturer names only (not session type).
- The lunch row displays `Lunch/Mass` using dedicated lunch/mass colour tokens.
- The navbar brand reads `Campion - Timetable`.

### Unit and Session Management

- Units represent courses.
- Units contain multiple sessions.
- Sessions are the atomic scheduling units.
- Each unit has:
  - id
  - code (exactly three letters followed by three numbers, e.g. `HIS101`; trimmed and uppercased; unique)
  - name
  - year level derived from the first integer in its code (1-3 only)
  - a subject derived from the unit-code letter prefix by the frontend parser (used for display, filtering, and colour only)
  - a teaching team of one or more lecturers
  - enrolled students through the shared `unit_students` relationship
- Each session has:
  - unit/course
  - type (`lecture` or `tutorial`)
  - one session-level lecturer selected from the unit teaching team
  - integer slot duration (displayed as hours in the UI)
- Sessions are schedulable once they have a unit, a session-level lecturer, a supported type, and a duration.
- Hidden session-student allocation rows are system-owned and not shown or editable in the UI.
- Lectures allocate all enrolled unit students.
- Tutorials allocate each enrolled student to exactly one tutorial, balanced and stable where practical.
- Room requirements are not stored directly on sessions in v1.
- Room capacity checks are derived from the session allocation count.
- A unit code is valid only when it has the `AAA999` structure, a supported subject prefix (HIS, PHI, THE, LIT, LAN, GRE, SCI), and a derived year of 1-3.
- Invalid unit codes disable unit create/save and show an invalid-unit warning.
- Unit cards, scheduled cards, and unscheduled cards take their colour from the unit's subject, not a generic hash.

### Lecturer Management

- Admin can create lecturers.
- Each lecturer has:
  - title (restricted to `Mr`, `Ms`, `Mrs`, `Dr`, `Fr`, `A/Prof.`, `Prof.`)
  - first name
  - last name
  - availability
- Lecturer availability is a warning-level validation rule in the frontend editor and a hard solver constraint later.
- A lecturer conflict can remain scheduled as a visible warning, but it blocks solver execution until resolved.
- The lecturer page shows taught units read-only; teaching-team edits remain owned by the unit page.

### Student Management

- Admin can create students.
- Students have no title.
- Each student has:
  - a required, unique `student_number` (the canonical institutional identifier, exactly 8 digits, separate from the internal record id)
  - first name
  - last name
  - year level restricted to 1-3
- Creating a student automatically enrols them into existing units with the same derived year.
- Admin can bulk-import students from a CSV via `POST /students/import-csv`. The upload is parsed in-memory and discarded (no file storage). Current rows (kept when `dest census date >= today` in Australia/Sydney) create or update students matched by `student_number` and additively enrol them into matching existing units; units are never created from the CSV and existing enrolments are never removed. Newly created students get an initial year level derived from their student number (future cohorts rejected, above 3 capped to 3); existing students keep their manually set year level but have their names updated. The response is aggregate counts only (created/updated students, added enrolments, and skipped/deduped row tallies).
- Creating a unit without an explicit student list defaults to students in the unit's derived year.
- Enrolment edits from the student and unit pages update the same `unit_students` relationship.
- Hidden session allocations derive student-conflict warnings and solver conflicts.
- If two sessions share one or more allocated students and overlap, the frontend allows the placement to remain but flags it as a warning and blocks solver execution.

### Room Management

- Admin can create rooms.
- Each room has;
  - name
  - capacity
  - room type (lecture/tutorial)
- Rooms define the timetable canvas.
- A session can only be assigned to a room if room capacity is greater than or equal to its hidden allocation count.
- A room cannot contain overlapping sessions.
- If a room is deleted, sessions scheduled in that room become unscheduled.

### Manual Scheduling

- Admin can drag unscheduled sessions onto the timetable.
- Admin can move scheduled sessions around the timetable.
- Admin can remove scheduled sessions back to the unscheduled pool.
- Clear All removes assignments from the frontend draft only; persistence still requires explicit Save.
- Manual scheduling edits update a frontend draft first.
- The unsaved draft is persisted in versioned browser storage so leaving `/timetable` or refreshing does not lose draft work; the stored draft clears after a successful save, and restored drafts remain subject to the existing blocking/auto-unschedule rules.
- The admin explicitly saves the timetable draft to persist assignments to the database.
- Saving an empty draft is valid and persists an empty assignment set.
- Blocking-invalid placements are rejected before entering the draft.
- Warning-invalid placements are allowed, highlighted, and may be saved.
- Solver execution is blocked while any frontend validation issue exists.


### Timetable Blocks

- The admin can reserve room-specific timetable cells as **blocks** — hard constraints that reserve a `day + slot + room` cell so no session can occupy it (e.g. chapel, mass, staff meeting, maintenance).
- Blocks are **not sessions**: they never appear in the unscheduled pool, are never scheduled by the solver, and never count as scheduled sessions.
- Every blocked cell is room-specific (`day + slot + room_id`); there is no all-rooms block abstraction.
- A block group covers one or more cells and may be unnamed or named:
  - **Unnamed block**: no name and no colour; renders grey/disabled with a lock icon.
  - **Named block**: a name plus one of three colours — `gold`, `light_blue`, or `light_pink` — and renders with a lock icon, the name, and its colour.
- Blocks are created from a block-selection mode in the sticky timetable action bar: the admin selects a same-day rectangular range of adjacent cells across slots and visible room columns, optionally names it, picks a colour when named, and saves. Selected cells are saved individually as `{ day, slot, room_id }`.
- Blocks persist immediately through the backend block API, independently of the timetable draft Save. Because they persist immediately, block create/edit/delete is disabled while the timetable draft is dirty (the admin must save or discard timetable changes first).
- Blocks are a hard constraint everywhere:
  - the frontend rejects manual placement (click and drag/drop) into any blocked cell, and an invalid hover over a blocked target shows no highlight and no pre-drop reason;
  - draft restoration and data-change cleanup automatically unschedule any assignment overlapping a block;
  - the backend defensively rejects saving an assignment whose occupied cells overlap a block;
  - the solver never generates an assignment occupying a blocked cell and may return a partial result when blocks make some sessions impossible.
- Creating or updating a block over saved assignments intentionally unschedules those assignments and returns the affected session IDs to the unscheduled pool.
- Deleting a block makes its cells usable again but does not reschedule anything.

### Frontend Validation Model

The frontend owns all user-facing validation in v1. Validation is split into two severities:

- `blocking`: the attempted placement is rejected and does not enter the draft timetable.
- `warning`: the placement is allowed to remain visible, but the scheduled card is marked with a warning and the solver is disabled.

Blocking rules are:

- room duplication / room double-booking;
- room capacity too small;
- session crossing lunch;
- session running off the timetable;
- placement into a cell reserved by a timetable block (`timetable_slot_blocked`).

Warning rules are:

- session-level lecturer overlap conflicts;
- allocated-student overlap conflicts;
- lecturer availability conflicts;
- any other non-blocking conflicts already represented by current v1 data.

Independent same-unit/session overlap is not a warning. Actual allocated-student overlap is authoritative.

If a room, unit, session, student, or lecturer change makes an existing scheduled assignment violate a blocking rule, the frontend automatically unschedules that session. Warning-invalid assignments may remain scheduled and may be saved, but the solver remains blocked until warnings are resolved.

### Constraint Evaluation

- The frontend evaluates user-facing constraints against the current timetable draft and saved assignments.
- Constraint violations are shown in the UI.
- Backend constraint definitions are added later only to mirror frontend validation for solver use.
- Hard constraints in v1 include:
  - lecturer conflicts
  - student conflicts
  - room conflicts
  - room capacity conflicts
  - lecturer availability conflicts
  - duration boundary conflicts
- The constraint system uses hardcoded constraint definitions.
- Admins provide constraint parameters through normal data entry, such as lecturer availability and room capacity.
- Admins do not define custom constraint rules in v1.

### Solver

- The solver uses the saved timetable state as input.
- Saved scheduled sessions are fixed and treated as locked.
- Unscheduled sessions are solver variables.
- The solver attempts to schedule as many unscheduled sessions as possible.
- Solver output may be partial.
- Successfully scheduled sessions become saved scheduled assignments.
- Failed sessions remain unscheduled.
- Solver runs asynchronously.
- Editing is disabled during solver execution.

## Scope

### In Scope

- Single-admin timetable scheduling system.
- Manual creation of rooms, lecturers, students, units, and sessions.
- Unit years derived from codes and student years restricted to 1-3.
- Shared unit-student enrolment editable from unit and student management.
- Unit teaching teams and session-level lecturers.
- Hidden lecture/tutorial student allocations used for capacity and conflicts.
- Frontend-only management search and filters.
- Main `/timetable` workspace.
- Fixed weekly timetable grid from Monday to Friday.
- Rooms nested under each day.
- Fixed time-slot rows.
- Sessions with integer-slot durations.
- Duration displayed as hours while remaining an integer slot count internally.
- Unscheduled session pool grouped by unit.
- Drag-and-drop manual scheduling.
- Moving scheduled sessions.
- Removing scheduled sessions back to the unscheduled pool.
- Frontend unit-code parser deriving subject, colour, and year for display, filtering, and validation UX.
- Browser-persisted unsaved timetable draft with schema versioning, cleared after a successful save.
- Room-specific timetable blocks as hard constraints (unnamed grey blocks; named gold/light-blue/light-pink blocks).
- Block-selection mode for reserving adjacent room-specific cells, with immediate block persistence and a dirty-draft editing guard.
- Blocks enforced as a hard constraint in frontend placement, defensive backend save validation, and the solver model.
- Hard constraint evaluation.
- Constraint violation highlighting.
- Solver button gating based on frontend validation issues.
- OR-Tools-based hard-constraint solver.
- Partial solver result handling.
- Warning message for partially solved timetables.
- Supabase authentication for the admin.
- Supabase Postgres persistence.
- Trigger.dev background solver execution.
- No timetable version history in v1; the latest timetable state is the source of truth.
- Backend timetable Excel export: a protected `GET /timetable/export.xlsx` API (Unit 93) that renders the saved timetable into a fixed, repo-owned Campion `.xlsx` template and streams it. Exports read saved state only, never mutate assignments, and are never persisted to the database or object storage.
- Frontend timetable Excel download UI (Unit 94): a `Download Timetable` button in the sticky timetable action bar that opens a required-title dialog and downloads the Unit 93 backend `.xlsx` for the current **saved** timetable. The browser never generates the workbook; it streams the backend blob and triggers a download (filename from the backend `Content-Disposition` or a dated fallback). Download is blocked while the saved timetable is unsafe to export (dirty draft, save or solver in progress, saved assignments/rooms/blocks still loading or failed, or an export already running) but stays available for partial saved timetables, unscheduled sessions, and warning-invalid saved assignments. Adds no blob storage and no export history.

### Out of Scope

- General file upload/import beyond the backend student CSV import API (`POST /students/import-csv`, Unit 90), including a frontend upload UI.
- Excel import templates (Excel *export* is in scope via Unit 93, with the frontend download UI in Unit 94; import is not).
- Student-facing timetable views.
- Lecturer-facing timetable views.
- Multi-admin collaboration.
- Multi-tenant organizations.
- Role-based access control beyond the admin.
- User-defined custom constraint rules.
- All-rooms or non-room-specific timetable blocks.
- Timetable blocks modeled as sessions or as soft constraints.
- Soft constraints in v1.
- Preference optimization, such as minimizing gaps or preferring mornings.
- Comparing multiple generated timetables.
- Timetable version history.
- Automatic session generation from units.
- User-visible or user-editable tutorial allocation groups.
- Continuous or arbitrary start times.
- Sessions that start outside fixed grid boundaries.
- Room equipment or specialist-facility requirements.
- Caching infrastructure such as Redis.
- Object storage in v1.

## Success Criteria

1. An authenticated admin can access the application and navigate between `/timetable`, `/units`, `/lecturers`, `/students`, and `/rooms`.
2. The admin can manually create rooms, lecturers, students, units, and sessions.
3. The timetable page shows no grid when no rooms exist and shows a clear empty-state message.
4. Once rooms exist, the timetable grid renders with days, rooms, and time-slot rows.
5. Schedulable sessions appear in the unscheduled pool grouped by unit.
6. The admin can drag unscheduled sessions onto the timetable.
7. The admin can move scheduled sessions to a different day, time, or room.
8. The admin can remove scheduled sessions back to the unscheduled pool.
9. Blocking placements are rejected immediately by the frontend.
10. Warning placements are allowed to remain scheduled and are visibly flagged.
11. The timetable draft can be explicitly saved to the backend with a save button.
12. Saved assignments persist after refresh.
13. The solver button is disabled whenever frontend validation reports any blocking or warning issue.
14. Data changes that create blocking violations automatically unschedule affected sessions.
15. Data changes that create warning violations keep sessions visible and flagged.
16. The solver respects all saved locked scheduled sessions.
17. The solver schedules as many unscheduled sessions as possible.
18. Sessions placed by the solver appear on the timetable as saved scheduled assignments.
19. Sessions that cannot be placed by the solver remain in the unscheduled pool.
20. The UI shows a warning when the solver produces a partial result.
21. Editing is disabled while the solver is running.
22. The application does not require file upload, export, soft constraints, version history, or student/lecturer views to be considered complete for v1.
23. The admin can reserve room-specific cells as blocks; unnamed blocks render grey with a lock icon and named blocks render with a label and an allowed colour (`gold`, `light_blue`, `light_pink`).
24. Sessions cannot be placed into blocked cells manually or by the solver, blocks never appear in the unscheduled pool or count as sessions, and deleting a block makes its cells usable again.
