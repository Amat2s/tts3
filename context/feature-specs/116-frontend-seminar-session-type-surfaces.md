# Unit 116 Spec: Frontend Seminar Session Type Surfaces

## Goal

Surface the new `seminar` session type (Unit 115) throughout the frontend: the
unit page can create/edit seminar sessions, the unscheduled pool and timetable
cards label them, and seminars receive their **own independent order-letter
series** (`Seminar A/B/C…`) exactly parallel to tutorial letters — separate from
the tutorial series, per unit.

Frontend-only. Depends on Unit 115 (backend accepts and returns `seminar`).
The Excel export is **Unit 117**.

## Role of this unit

The frontend already treats `session_type` as a small closed union and renders
per-type labels. This unit widens that union to three values and adds a seminar
lettering path that mirrors `computeTutorialLetters` — including the same
day → start-slot → room → session-id ordering so a seminar's on-card letter
lines up with the letter the same session gets in the Unit 117 export.

## Design

- System boundary: `frontend/` only. No backend/API change (Unit 115 already
  returns `seminar`).
- Key surfaces:
  `frontend/src/lib/api/sessions.ts` (the `SessionType` union),
  `frontend/src/routes/units.tsx` (`SESSION_TYPES` selector),
  `frontend/src/features/timetable/tutorialLetters.ts` (add the parallel seminar
  series),
  `frontend/src/features/timetable/ScheduledSessionCard.tsx`,
  `frontend/src/features/timetable/UnscheduledSessionCard.tsx`,
  `frontend/src/features/timetable/DragPreviewCard.tsx`,
  `frontend/src/features/timetable/unscheduledPoolView.ts` (`SESSION_TYPE_ORDER`).

## Implementation

### Types

- `frontend/src/lib/api/sessions.ts`: widen
  `export type SessionType = 'lecture' | 'tutorial' | 'seminar'`. This flows into
  `Session`, `SessionCreate`, `SessionUpdate`, and `SchedulableSession`
  automatically. Update the Unit 60 comment noting the type is now three values.

### Unit page selector

- `frontend/src/routes/units.tsx`: add `{ value: 'seminar', label: 'Seminar' }`
  to `SESSION_TYPES`. The create/edit session controls already map over
  `SESSION_TYPES`, so the selector, default handling, and update path pick it up.
  Default new-session type stays `lecture`.

### Order letters (independent seminar series)

- `frontend/src/features/timetable/tutorialLetters.ts`: generalise the
  per-unit lettering into a shared helper keyed by session type, then expose a
  `computeSeminarLetters(assignments, rooms)` alongside `computeTutorialLetters`.
  - Same ordering as tutorials: day (Mon–Fri) → start slot (s1–s7) →
    `roomSortIndex` (fixed export room order, list fallback) → `session_id`.
  - Seminar letters are computed over `session_type === 'seminar'` assignments
    **only**, producing an A/B/C… series **independent** of tutorial letters
    (a unit with 2 tutorials and 2 seminars yields Tutorial A/B *and*
    Seminar A/B).
  - Keep the two functions as thin wrappers over one implementation to avoid
    drift; do not merge the two series into one counter.
- Wherever `computeTutorialLetters` is consumed (the timetable route building
  the letter map for cards), also compute and thread the seminar letter map.

### Card labels

- `ScheduledSessionCard.tsx`: extend `sessionTypeLabel` so
  `session_type === 'seminar'` renders `Seminar{suffix} ({initials})`, where
  `suffix` is the seminar letter (parallel to the existing tutorial branch). Add
  a `seminarLetter?` prop mirroring `tutorialLetter?`, or generalise the single
  letter prop — pick the smaller diff and keep lectures label-letter-free.
- `UnscheduledSessionCard.tsx`: add `seminar: 'Seminar'` to `SESSION_TYPE_LABEL`.
- `DragPreviewCard.tsx`: add `seminar: 'Sem'` to `SESSION_TYPE_LABEL` (short form,
  matching `tutorial: 'Tut'`).

### Unscheduled pool ordering

- `unscheduledPoolView.ts`: add `seminar: 2` to `SESSION_TYPE_ORDER` so the pool
  sorts lecture → tutorial → seminar within a unit. Confirm the `Record<...>`
  type over the widened union stays exhaustive (compiler will flag a missing key).

### Validation

- No new validation rule. `session_type` is not itself a warning/blocking driver;
  seminars produce student-conflict and capacity data through the same
  `allocated_student_ids` / `student_count` fields as tutorials, so the existing
  warning engine covers them with no change. Verify no validation code
  switch-matches only `lecture`/`tutorial` and silently drops `seminar`.

## Out of scope

- Excel export labelling/styling (Unit 117).
- Any backend/API change.
- New colours or tokens for seminars — cards keep taking colour from the unit's
  subject (unchanged); the only per-type distinction is the text label/letter.

## Dependencies

- Unit 115 (backend `seminar` support). No new packages.

## Tests

Frontend (vitest / RTL):

- The unit page offers Lecture / Tutorial / Seminar and can create and edit a
  seminar session.
- `computeSeminarLetters` assigns an independent A/B/C series per unit, using the
  same ordering as tutorials, and does **not** share a counter with tutorial
  letters (a unit with tutorials and seminars gets both series starting at A).
- `ScheduledSessionCard` renders `Seminar A (…)`; a lone seminar renders
  `Seminar (…)` with no letter, matching tutorial behaviour.
- Unscheduled and drag-preview cards render the seminar label / short form.
- The unscheduled pool orders lecture → tutorial → seminar.
- Type exhaustiveness: `SessionType`-keyed records compile over three values.

## Verification checklist

- Admin can create, edit, schedule, and see seminar sessions end to end against a
  Unit-115 backend.
- Seminar order letters are an independent per-unit series matching tutorial
  ordering rules.
- No lecture/tutorial-only switch silently ignores seminars.
- Frontend tests and build pass; `context/progress-tracker.md` updated.
