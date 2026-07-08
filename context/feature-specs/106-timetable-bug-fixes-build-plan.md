# Timetable Bug-Fix Batch Build Plan (Units 106–112)

## Overview

A batch of post-v1 UX/behaviour fixes for the timetable workspace, blocks,
management deletes, and the sticky action bar, taken from the **Bug fixes / UX
problems** list in `context/TODO.md`. Each unit is scoped to a single subsystem
and boundary so it can be verified end to end on its own.

The other `TODO.md` sections (saved-tables feature, similar-timetable soft
constraint, lecturer-info upload, Excel-format text display) are **out of scope
for this batch** and are not specced here.

## Units

| Unit | Title | Boundary | Source items |
| ---- | ----- | -------- | ------------ |
| 106 | Timetable action bar: save-state, download lock, message clearing | `frontend/` | save freeze; lock download when unsaved; clear messages except clashes |
| 107 | Timetable card sizing & drop positioning | `frontend/` | drop slot under mouse; +1px-per-extra-hour height for multi-slot sessions/blocks |
| 108 | Timetable grid view controls & session search/filter | `frontend/` | course/lecturer/student filter+search; smaller room text; extend view 2× narrower |
| 109 | Timetable blocks folded into the draft | `frontend/` | edit blocks while unsaved; stop disabling blocks |
| 110 | Timetable block click-toggle creation | `frontend/` | change block creation to click/toggle cells like preferences |
| 111 | Backend guarded deletes with dependency reasons | `backend/` | catch DB delete failures; report what the entity is tied to |
| 112 | Frontend delete-blocked error surfacing | `frontend/` | show the "can't delete yet / tied to X" reason on management pages |

## Ordering & dependencies

- 106, 107, 108 are independent frontend units and can land in any order.
- 110 (click-toggle creation) builds on 109 (draft-integrated blocks); do 109 first.
- 112 (frontend delete errors) depends on 111 (backend structured delete errors).
- Blocks (109/110) and the block-touching parts of 108 (view controls row) share
  the timetable grid; coordinate but keep the units separate.

## Context updates

Units that change documented behaviour must update the relevant context file in
the same unit (called out per spec), then record completion in
`context/progress-tracker.md`. Unit 109 changes the block persistence contract,
so it updates `project-overview.md` and `architecture-context.md`.
