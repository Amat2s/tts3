# Seminar Session Type (Units 115–118) Acceptance Flow

Date prepared: 2026-07-13

Use one authenticated admin workspace with at least the eight fixed export rooms
(`PDS, L1.05, Bromley, L1.08, Dawson, L1.10, L1.12, JTW`), one lecturer, and one
unit with several enrolled students. For each step, check exactly one result.
This checklist covers the Unit 115 backend allocations, the Unit 116 frontend
surfaces, and the Unit 117 Excel-export labelling, verified together in Unit 118.

> A **seminar** is a third session type alongside `lecture` and `tutorial`. It
> behaves exactly like a tutorial for hidden student allocation — enrolled
> students are divided into balanced, stable groups with each student in exactly
> one seminar — but the seminar partition is a **second, wholly independent**
> partition: computed with no reference to the tutorial partition (and vice
> versa), so the two may coincidentally overlap and are never coordinated or
> anti-correlated. Seminars get their own independent `Seminar A/B/C…` order
> letters, parallel to and never sharing a counter with tutorial letters.

## Manual Checklist

1. Sign in and open a unit with several enrolled students on `/units`. `[ ] PASS  [ ] FAIL`
2. Add both a **Tutorial** and a **Seminar** session to the unit; confirm the session-type selector offers Lecture, Tutorial, and Seminar. `[ ] PASS  [ ] FAIL`
3. Confirm each schedulable session appears in the unscheduled pool, grouped by unit and ordered lecture → tutorial → seminar. `[ ] PASS  [ ] FAIL`
4. Schedule the tutorials and seminars on `/timetable`; confirm the cards show independent `Tutorial A/B` and `Seminar A/B` letter series (adding a seminar never renumbers a tutorial and vice versa). `[ ] PASS  [ ] FAIL`
5. Confirm a seminar card that overlaps another session sharing one or more of its **allocated** students shows a student-conflict warning (not the full enrolment). `[ ] PASS  [ ] FAIL`
6. Try to place a seminar into a room whose capacity is smaller than the seminar's allocated group; confirm the placement is rejected for capacity (checked against the group size, not the unit's full enrolment). `[ ] PASS  [ ] FAIL`
7. Leave a seminar unscheduled and run the solver; confirm it schedules the seminar like a tutorial with no feasibility regression, and that re-running is deterministic. `[ ] PASS  [ ] FAIL`
8. Use **Download Timetable** to export; confirm seminars are labelled `CODE Seminar X (INIT)` with the **same** letters shown on-card, and reuse their unit's subject class styling (no distinct seminar colour). `[ ] PASS  [ ] FAIL`
9. Confirm export style parity is otherwise unchanged (columns, rows, page setup, tab colour, static merges, and the Mon/Wed/Fri grey vs Tue/Thu white empty cells all match the template). `[ ] PASS  [ ] FAIL`

## Scope guard

Confirm this batch did **not** introduce:

- any new seminar behaviour beyond Units 115–117;
- anti-overlap or correlated grouping between tutorials and seminars (the two
  partitions are deliberately independent);
- a distinct seminar colour, style, or export template change (seminars reuse
  the subject class styling);
- exposure of hidden allocation membership through any API;
- any new room-type-vs-session-type rule.

## Automated evidence (Unit 118 pass, 2026-07-13)

- Backend: **630 passed** (`APP_ENV=ci`, dummy `DATABASE_URL`/`SUPABASE_URL`),
  including `test_115_seminar_session_type.py`, the seminar cases in
  `test_93_timetable_excel_export.py`, and the new end-to-end
  `test_118_seminar_acceptance.py` (create → allocate → schedule → capacity →
  solve → export, asserting balanced independent partitions and independent
  on-card/export letters).
- Frontend: **415 passed across 38 files** (unchanged from Unit 116; Unit 118
  adds no frontend code).
