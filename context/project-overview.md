# Project Overview

## Overview

This application is a university timetable scheduling system for administrators. The admin manually creates rooms, lecturers, students, units, and sessions, then uses a timetable workspace to manually place sessions or run a constraint solver to schedule the remaining unscheduled sessions. The system uses fixed weekly time slots, room-based timetable columns, and hard constraints to prevent conflicts involving lecturers, students, rooms, capacity, availability, and session duration. In v1, the application is focused on a single admin creating and managing one timetable, with no student or lecturer-facing views.

## Goals

1. Build a timetable scheduling workspace where an admin can view, edit, and generate a weekly university timetable.
2. Allow the admin to manually create the core scheduling data: rooms, lecturers, students, units, and sessions.
3. Treat sessions as the atomic schedulable blocks used by the constraint solver.
4. Represent the timetable as a fixed weekly grid with Monday to Friday columns, rooms nested under each day, and time slots as rows.
5. Allow unscheduled sessions to be dragged onto the timetable manually.
6. Allow scheduled sessions to be moved within the timetable or removed back to the unscheduled pool.
7. Highlight hard constraint violations without preventing the admin from making invalid manual placements.
8. Disable solver execution while hard constraint violations exist.
9. Use the solver to schedule as many unscheduled sessions as possible while respecting all locked scheduled sessions.
10. Keep v1 focused on hard constraints only, with soft constraints deferred to v2.

## Core User Flow

1. The admin signs in.
2. The admin lands on `/timetable`.
3. If no rooms exist, the timetable canvas is not shown. The page displays a message telling the admin to add rooms to generate the timetable canvas.
4. The admin uses the top navigation bar to move between:
   - `/timetable`
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
    - a name
    - a lecturer
    - a duration
12. Students are optional for a session. If a session has no students, it has no known student-conflict constraints.
13. Schedulable sessions appear underneath the timetable grid in the unscheduled pool.
14. The unscheduled pool groups sessions by unit.
15. The admin can drag an unscheduled session onto the timetable grid.
16. A placed session immediately becomes scheduled and locked.
17. The admin can drag a scheduled session to a different day, time slot, or room.
18. The admin can remove a scheduled session from the timetable, returning it to the unscheduled pool.
19. If a manual placement violates a hard constraint, the placement is allowed but the violation is highlighted.
20. While any hard constraint violation exists, the solver button is disabled.
21. Once no hard constraint violations exist, the admin can run the solver.
22. While the solver is running, editing is disabled.
23. The solver runs against a snapshot of the current timetable state.
24. Locked scheduled sessions are treated as fixed inputs to the solver.
25. The solver attempts to schedule all remaining unscheduled sessions.
26. Sessions successfully scheduled by the solver are placed onto the timetable and become locked.
27. Sessions the solver cannot place remain in the unscheduled pool.
28. If the solver returns a partial result, the UI shows a warning and leaves failed sessions visible below the timetable.
29. The admin can continue manually adjusting the timetable after the solver finishes.

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

### Unit and Session Management

- Units represent courses.
- Units contain multiple sessions.
- Sessions are the atomic scheduling units.
- Each unit has:
  - id
  - name
  - lecturer
  - students
- Each session has:
  - name (inherit unit name + label distinction (lecture/tutorial))
  - unit/course (inherit)
  - lecturer (inherit)
  - optional students (inherit)
  - duration
- Sessions are schedulable once they have a unit, name, lecturer, and duration.
- Room requirements are not stored directly on sessions in v1.
- Room capacity checks are derived from the number of students assigned to the session.

### Lecturer Management

- Admin can create lecturers.
- Each lecturer has:
  - title
  - first name
  - last name
  - availability
- Lecturer availability is used as a hard scheduling constraint.
- A lecturer cannot be scheduled for overlapping sessions.

### Student Management

- Admin can create students.
- Students can be assigned to sessions.
- Each student has:
  - title
  - first name
  - last name
  - year level
- Student assignment is used to derive student-conflict constraints.
- If two sessions share one or more students, those sessions cannot overlap.
- Sessions may exist without students in v1.

### Room Management

- Admin can create rooms.
- Each room has;
  - name
  - capacity
  - room type (lecture/tutorial)
- Rooms define the timetable canvas.
- A session can only be assigned to a room if the room capacity is greater than or equal to the number of students in the session.
- A room cannot contain overlapping sessions.
- If a room is deleted, sessions scheduled in that room become unscheduled.

### Manual Scheduling

- Admin can drag unscheduled sessions onto the timetable.
- Admin can move scheduled sessions around the timetable.
- Admin can remove scheduled sessions back to the unscheduled pool.
- Scheduled sessions are locked by definition.
- Invalid placements are allowed but highlighted.
- Solver execution is blocked while hard constraint violations exist.

### Constraint Evaluation

- The application evaluates hard constraints against the current timetable state.
- Constraint violations are shown in the UI.
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

- The solver uses the current timetable state as input.
- Scheduled sessions are fixed and treated as locked.
- Unscheduled sessions are solver variables.
- The solver attempts to schedule as many unscheduled sessions as possible.
- Solver output may be partial.
- Successfully scheduled sessions become locked.
- Failed sessions remain unscheduled.
- Solver runs asynchronously.
- Editing is disabled during solver execution.

## Scope

### In Scope

- Single-admin timetable scheduling system.
- Manual creation of rooms, lecturers, students, units, and sessions.
- Main `/timetable` workspace.
- Fixed weekly timetable grid from Monday to Friday.
- Rooms nested under each day.
- Fixed time-slot rows.
- Sessions with integer-slot durations.
- Unscheduled session pool grouped by unit.
- Drag-and-drop manual scheduling.
- Moving scheduled sessions.
- Removing scheduled sessions back to the unscheduled pool.
- Hard constraint evaluation.
- Constraint violation highlighting.
- Solver button gating based on hard violations.
- OR-Tools-based hard-constraint solver.
- Partial solver result handling.
- Warning message for partially solved timetables.
- Supabase authentication for the admin.
- Supabase Postgres persistence.
- Trigger.dev background solver execution.
- No timetable version history in v1; the latest timetable state is the source of truth.

### Out of Scope

- File upload/import for v1.
- CSV or Excel import templates.
- Timetable export/download for v1.
- Student-facing timetable views.
- Lecturer-facing timetable views.
- Multi-admin collaboration.
- Multi-tenant organizations.
- Role-based access control beyond the admin.
- User-defined custom constraint rules.
- Soft constraints in v1.
- Preference optimization, such as minimizing gaps or preferring mornings.
- Comparing multiple generated timetables.
- Timetable version history.
- Automatic session generation from units.
- Automatic student allocation to sessions.
- Continuous or arbitrary start times.
- Sessions that start outside fixed grid boundaries.
- Room equipment requirements, room types, or specialist facilities.
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
9. Constraint violations are detected and displayed for invalid timetable states.
10. The solver button is disabled whenever hard constraint violations exist.
11. The solver respects all locked scheduled sessions.
12. The solver schedules as many unscheduled sessions as possible.
13. Sessions placed by the solver appear on the timetable and become locked.
14. Sessions that cannot be placed by the solver remain in the unscheduled pool.
15. The UI shows a warning when the solver produces a partial result.
16. Editing is disabled while the solver is running.
17. Data changes that make the timetable invalid do not silently modify the timetable; instead, the timetable remains visible and violations are shown.
18. The application does not require file upload, export, soft constraints, version history, or student/lecturer views to be considered complete for v1.
