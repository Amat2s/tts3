# Post-V1 Adjustments Build Plan — Units 58–71

## Status

- Units 58-71: complete.

## Planning Rules

These units extend the completed v1 release candidate without jumping into broader v2 scope. The work is intentionally split so database/schema changes, API-client changes, frontend UI changes, solver changes, and final regression coverage are not mixed into one implementation step.

Keep the existing architectural invariants:

- frontend-owned user-facing validation;
- manual timetable edits update the frontend draft first;
- timetable assignments persist only through explicit save;
- backend assignment checks remain defensive;
- solver runs from saved backend state;
- sessions remain the atomic schedulable unit;
- no soft constraints, version history, file import/export, student-facing views, lecturer-facing views, multi-admin collaboration, Redis, or object storage.

## Resolved Product Decisions

- Unit year level is derived by parsing the first integer in the unit code.
- Only year levels 1, 2, and 3 are valid.
- Units have exactly one derived year level.
- Student year level remains a student field, but it is restricted to 1–3.
- Unit student selection should initially select all current students in the derived year, but the admin can manually add or remove students afterward.
- When a new student is added, they are automatically enrolled in existing units whose derived year level matches the student's year level.
- Student enrollment edited from `/students` and unit enrollment edited from `/units` use the same underlying `unit_students` relationship.
- Units have multiple teaching lecturers.
- Each session has one assigned lecturer, selected from that unit's teaching lecturers.
- Existing unit `lecturer_id` values migrate into the new unit teaching team.
- Existing sessions are assigned the existing unit lecturer when only one lecturer exists for that unit.
- A session is not schedulable until it has a session-level lecturer.
- Session types are only `lecture` and `tutorial`.
- Admins can create any number of lectures and tutorials.
- Lecture sessions include every student enrolled in the unit.
- Tutorial sessions use a hidden persistent allocation table that balances enrolled students across tutorial sessions as evenly and stably as practical.
- Tutorial allocations are not shown or editable in the UI.
- Student conflicts and room capacity are derived from hidden session-student allocation data.
- Independent unit/session-overlap warnings are retired; shared allocated students determine conflicts.
- Lecturer availability save behavior should be hardened with a replace-all transaction.
- Management-page search/filtering is frontend-only for now.
- Clear all on the timetable clears the frontend draft only and requires explicit save to persist.
- The timetable notification/action bar should be sticky.
- Duration remains an integer slot count internally but is labeled as hours in the UI.
- The solver button label becomes `Generate Timetable` and remains blue.
- The save button displays `Saved` when the draft matches the saved backend state.

---

## 58. Backend Year-Level Derivation and Enrollment Sync

**System boundary:** `backend/`

**What it builds:**

- Unit year level derived from unit code.
- Student year levels restricted to 1–3.
- Backend helpers for parsing unit year level.
- Student-create enrollment sync into matching current units.
- Unit-create default student selection from matching current students when no explicit list is provided.
- Student responses include enrolled unit summaries/counts.

**Visible result:**

Backend data now understands year levels consistently without a manually editable unit year field.

**Dependencies required first:**

Units 1–57.

---

## 59. Backend Unit Teaching Team and Session-Level Lecturer

**System boundary:** `backend/`

**What it builds:**

- `unit_lecturers` many-to-many table.
- Migration from `units.lecturer_id` to unit teaching team rows.
- `sessions.lecturer_id` field.
- Session lecturer validation against the unit teaching team.
- Schedulable session DTOs use the session-level lecturer.

**Visible result:**

Units can have multiple lecturers and each session is taught by one actual lecturer.

**Dependencies required first:**

Unit 58.

---

## 60. Backend Session Types and Hidden Session-Student Allocations

**System boundary:** `backend/`

**What it builds:**

- Session type enum reduced to `lecture` and `tutorial`.
- Hidden `session_student_allocations` table.
- Allocation rebuild/rebalance service.
- Lecture allocations include every enrolled unit student.
- Tutorial allocations are balanced and stable.
- Schedulable sessions and assignments derive student counts from allocation rows.

**Visible result:**

Backend scheduling data reflects lecture/tutorial membership correctly, without exposing tutorial groups in the UI.

**Dependencies required first:**

Units 58 and 59.

---

## 61. Backend Lecturer Availability Replace-All Save Hardening

**System boundary:** `backend/`

**What it builds:**

- Transactional replace-all availability save behavior.
- Delete/flush/reinsert pattern for unavailable slots.
- Tests proving availability can be edited repeatedly.

**Visible result:**

Lecturer availability can be changed reliably after it has already been saved.

**Dependencies required first:**

Unit 58.

---

## 62. Frontend API Type Alignment for Post-V1 Scheduling Model

**System boundary:** `frontend/`

**What it builds:**

- API DTO updates for units, students, lecturers, sessions, schedulable sessions, and assignments.
- Frontend types for unit year level, teaching lecturers, session lecturer, and allocated student IDs/counts.
- No route UI changes yet.

**Visible result:**

The frontend compiles against the new backend response/request model.

**Dependencies required first:**

Units 58–61.

---

## 63. Frontend Unit and Session Management Redesign

**System boundary:** `frontend/`

**What it builds:**

- Wider unit modal.
- Derived year level display from unit code.
- Multiple lecturer selector for unit teaching team.
- Student selector with search and year-level filter.
- Session-level lecturer selector.
- Duration stepper labeled in hours.
- Session type selector reduced to Lecture/Tutorial.

**Visible result:**

The unit modal manages the new post-v1 unit/session model without separate session dialogs.

**Dependencies required first:**

Unit 62.

---

## 64. Frontend Student Enrollment Management

**System boundary:** `frontend/`

**What it builds:**

- Student create/edit modal includes enrolled unit selection.
- New students auto-select existing units matching their year level.
- Student table shows enrolled unit count.
- Student-side changes invalidate unit/session/timetable queries that depend on enrollment.

**Visible result:**

The admin can manage the same enrollment relationship from the student page.

**Dependencies required first:**

Units 62 and 63.

---

## 65. Frontend Lecturer Teaching Visibility

**System boundary:** `frontend/`

**What it builds:**

- Lecturer page shows units taught.
- Lecturer modal remains read-only for teaching assignments.
- Units page shows selected teaching lecturers clearly.
- No lecturer-side editing of unit teaching assignments.

**Visible result:**

Lecturers visibly show which units they teach, while editing remains owned by the unit modal.

**Dependencies required first:**

Units 62 and 63.

---

## 66. Frontend Management Search and Filters

**System boundary:** `frontend/`

**What it builds:**

- Frontend-only search/filter controls for rooms, students, lecturers, and units.
- Room search by name and filter by type.
- Student search plus filters by year level and enrolled unit.
- Lecturer search plus filter by taught unit.
- Unit search plus filters by derived year level and teaching lecturer.

**Visible result:**

Management pages remain usable as data grows, without backend query parameters yet.

**Dependencies required first:**

Units 62–65.

---

## 67. Frontend Timetable Validation and DTO Integration

**System boundary:** `frontend/validation` + `frontend/features/timetable`

**What it builds:**

- Timetable rendering model uses session-level lecturer IDs/display names.
- Warning validation uses allocated student IDs for student overlaps.
- Room capacity uses allocated student count.
- Lecturer overlap and availability use session-level lecturer IDs.
- Independent unit/session-overlap warning is removed from active validation.

**Visible result:**

Manual scheduling validation matches the new lecture/tutorial allocation model.

**Dependencies required first:**

Units 60 and 62.

---

## 68. Backend Solver Allocation and Session-Lecturer Integration

**System boundary:** `backend/constraints/` + `backend/solver/`

**What it builds:**

- Constraint graph and snapshot builder use session-level lecturer IDs.
- Student conflicts are derived from session allocation rows.
- Room capacity uses allocated student count.
- Unit/session-overlap graph is retired unless still needed only as a non-active compatibility type.
- Solver tests updated for lecture/tutorial allocation behavior.

**Visible result:**

The solver schedules against the same per-session lecturer and hidden allocation data used by frontend validation.

**Dependencies required first:**

Units 59 and 60.

---

## 69. Frontend Unscheduled Pool Redesign

**System boundary:** `frontend/features/timetable`

**What it builds:**

- Unit boxes across the page.
- Sessions stacked in one column inside each unit box.
- Unit code/name shown once in the unit box heading.
- Session cards no longer repeat unit code/name.
- Empty unit boxes disappear.
- Search and year-level filter for unscheduled sessions.
- Completion message when all schedulable sessions are scheduled.

**Visible result:**

The unscheduled pool is cleaner and easier to scan without changing scheduling behavior.

**Dependencies required first:**

Units 62 and 67.

---

## 70. Frontend Timetable Action Polish

**System boundary:** `frontend/features/timetable`

**What it builds:**

- Clear all draft assignments button with warning dialog.
- Sticky notification/action bar above the timetable.
- Save button displays `Saved` when clean.
- Solver button label becomes `Generate Timetable`.
- Solver button remains blue in enabled and disabled states.

**Visible result:**

The timetable workspace has the requested final interaction polish while preserving explicit-save behavior.

**Dependencies required first:**

Units 67 and 69.

---

## 71. Post-V1 Regression, Docs, and Acceptance Pass

**System boundary:** Full app verification + context docs

**What it builds:**

- Backend tests for migrations, enrollment sync, unit lecturer teams, session lecturer validation, allocation rebalancing, availability editing, solver constraints.
- Frontend tests for management filters, unit modal behavior, student enrollment UI, validation, pool redesign, clear-all dialog, sticky action bar, and button labels.
- Context docs updated to reflect the post-v1 model.
- Progress tracker updated.

**Visible result:**

The post-v1 adjustment batch is verified end to end and documented.

**Dependencies required first:**

Units 58–70.
