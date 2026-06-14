# Unit 62 Spec: Frontend API Type Alignment for Post-V1 Scheduling Model

## Goal

Update frontend API clients and shared DTO types so the frontend compiles against the new post-v1 backend model before route components are changed. This unit should not alter user-facing route behavior except where required to keep TypeScript passing.

## Design

- Keep this unit inside `frontend/src/lib/api/` and related type modules.
- Do not redesign pages in this unit.
- Do not add filtering UI in this unit.
- Do not change timetable validation behavior in this unit.
- Avoid duplicated DTO definitions; keep API types centralized.
- Keep frontend view models separate from API DTOs.

## Implementation

### Unit API types

Update `frontend/src/lib/api/units.ts`:

- Replace single `lecturer` / `lecturer_id` with:
  - `lecturers: LecturerSummary[]`
  - `lecturer_ids: string[]` in create/update request types.
- Add `year_level: 1 | 2 | 3` to `Unit` response type.
- Do not expose `year_level` in create/update request inputs.
- Keep `students: StudentSummary[]`.
- Keep `student_ids: string[]` in create/update request inputs.
- Update unit error parsing for invalid unit code/year-level parser failures.

### Student API types

Update `frontend/src/lib/api/students.ts`:

- Restrict `Student.year_level` to `1 | 2 | 3`.
- Add enrolled unit summaries to `Student` response:
  - `units: UnitSummary[]`
  - `unit_count: number`
- Add optional `unit_ids?: string[]` to create/update input only if backend Unit 58/64 supports student-side enrollment in the same request shape. If the backend exposes a separate endpoint, add explicit client functions instead.
- Keep existing CRUD functions authenticated through the base API client.

### Lecturer API types

Update `frontend/src/lib/api/lecturers.ts`:

- Add taught unit summaries to `Lecturer` response if backend returns them:
  - `units: UnitSummary[]`
  - `unit_count: number`
- Do not add unit-editing fields to lecturer create/update inputs.
- Keep availability functions unchanged except any DTO typing updates from Unit 61.

### Session API types

Update `frontend/src/lib/api/sessions.ts`:

- Change `SessionType` union to `lecture | tutorial` only.
- Add `lecturer_id` and optional lecturer summary/display fields to `Session` and create/update inputs.
- `SessionCreate` and `SessionUpdate` should support setting `lecturer_id`.
- Update `SchedulableSession`:
  - `lecturer_id`
  - `lecturer_display_name`
  - `student_count` from allocation rows
  - `allocated_student_ids: string[]` if returned for validation
  - `unit_year_level: 1 | 2 | 3`
- Remove lab/workshop from frontend type unions and sort orders.

### Assignment API types

Update `frontend/src/lib/api/assignments.ts`:

- Assignment responses should include session-level lecturer fields.
- Assignment responses should include `student_count` from allocation rows.
- Add `allocated_student_ids` if the backend returns it for validation after loading saved assignments.
- Keep save request unchanged: session/day/start slot/room only.

### Timetable rendering model preparation

Update `frontend/src/features/timetable/assignment.ts` only enough to compile:

- Add `lecturer_id` if absent.
- Add `allocated_student_ids` if needed by later validation.
- Keep existing rendering behavior unchanged until Unit 67.

### Type guards and constants

Update any constants that list session types:

- lecture
- tutorial

Remove Lab/Workshop from frontend dropdown constants only if referenced in API-level helper modules. Route UI changes happen in Unit 63.

## Dependencies

No new package dependencies expected.

## Verification checklist

- Frontend builds with strict TypeScript.
- No `any` is introduced.
- Unit API client no longer assumes a single unit lecturer.
- Session API client supports session-level lecturer.
- Session type union contains only lecture/tutorial.
- Student API client exposes enrolled unit count/summaries.
- Lecturer API client exposes taught unit count/summaries but does not allow editing them.
- Assignment and schedulable session DTOs carry enough data for later validation.
- No route redesign or product behavior change is introduced in this unit.
