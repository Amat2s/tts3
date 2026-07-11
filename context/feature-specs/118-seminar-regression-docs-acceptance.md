# Unit 118 Spec: Seminar Regression, Docs, and Acceptance

## Goal

Close out the seminar feature (Units 115–117) with an end-to-end acceptance pass
and the context-doc updates the earlier units depend on but should not each own
in isolation. No new behaviour — this unit proves the three slices work together
and brings `context/` in sync.

## Role of this unit

Units 115–117 each ship a slice (backend allocations, frontend surfaces, export).
This unit verifies the full admin flow across those boundaries and makes the
canonical docs describe seminars, so the context files stay the source of truth.

## Acceptance flow (manual + automated)

Drive a real unit through the whole path:

1. Create a unit with several enrolled students.
2. Add tutorials **and** seminars to the unit.
3. Confirm hidden allocations give each enrolled student exactly one tutorial and
   exactly one seminar, each set balanced, and the two partitions independent
   (changing seminar sessions leaves tutorial groups intact and vice versa).
4. Schedule tutorials and seminars on the timetable; confirm cards show
   independent `Tutorial A/B` and `Seminar A/B` letter series.
5. Confirm student-conflict warnings and capacity checks fire for seminars using
   their allocated group (not full enrolment).
6. Run the solver with unscheduled seminars present; confirm it schedules them
   like tutorials with no feasibility regression and remains deterministic.
7. Export the timetable; confirm seminars are labelled `Seminar X` with the same
   letters shown on-card, and style parity is unchanged.

## Docs to update

- `context/project-overview.md`: session-type wording (Units contain
  lecture/tutorial/**seminar**; the schedulability list; the allocation
  description — "seminars divide enrolled students into their own balanced,
  independent groups").
- `context/architecture-context.md`: invariant 1 (session type is
  `lecture | tutorial | seminar`), invariant 19 (seminars form a second
  independent balanced partition, each enrolled student in exactly one seminar),
  and invariant 32 (export labels now include `Seminar X`).
- `context/progress-tracker.md`: mark Units 115–118 complete and record any
  follow-ups.

## Out of scope

- Any new seminar behaviour beyond Units 115–117.
- Anti-overlap grouping between tutorials and seminars (explicitly not built —
  the decision is independent partitions).

## Verification checklist

- The full create → allocate → schedule → validate → solve → export flow works
  for seminars end to end.
- Tutorial and seminar partitions are independent and both balanced.
- All backend and frontend test suites pass.
- `context/project-overview.md`, `context/architecture-context.md`, and
  `context/progress-tracker.md` describe seminars accurately.
