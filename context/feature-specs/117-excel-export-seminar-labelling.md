# Unit 117 Spec: Excel Export Seminar Labelling

## Goal

Make the Unit 93 timetable Excel export label seminar sessions as
`UNITCODE Seminar X (INITIALS)`, giving seminars their **own independent
per-unit order-letter series** (`Seminar A/B/C…`) parallel to tutorial letters —
the same series and ordering the frontend produces in Unit 116, so on-card and
exported letters agree.

Backend export-only (`backend/services/timetable_excel_export.py`). Depends on
Unit 115 (seminars exist and carry allocations). No template rebuild.

## Role of this unit

The export already paints class cells by **subject** (unit-code prefix), not by
session type — so seminars are painted with the correct class style with no
styling work (per invariant 32). The only export gap is the **text label** and
the **letter series**: today `_session_label` handles only Tutorial/Lecture and
`_tutorial_letters` letters only tutorials. This unit adds the seminar branch and
a `_seminar_letters` series that mirrors `_tutorial_letters` exactly.

## Design

- System boundary: `backend/` export service only. No template change, no new
  named styles, no page-layout/style-parity change.
- Seminars reuse the existing subject-based class styling
  (`tt_class_*`) and the class-cell alignment path unchanged.
- New letter series is independent: a unit with tutorials and seminars gets both
  `Tutorial A/B` and `Seminar A/B`.

## Implementation

`backend/services/timetable_excel_export.py`:

- Add `_seminar_letters(assignments)` mirroring `_tutorial_letters`:
  - per-unit, over `session_type == SessionType.SEMINAR` assignments only;
  - identical ordering key: `DAY_ORDER` → `ORDERED_SLOTS` → `_room_index(room.name)`
    → `session_id`;
  - independent A/B/C… counter (not shared with tutorial letters).
  - Factor the shared body of `_tutorial_letters`/`_seminar_letters` into one
    helper parametrised by session type to prevent drift.
- Extend `_session_label(session, letter)` to add a seminar branch:
  `f"{code} Seminar{suffix} ({initials})"` with `suffix = f" {letter}"` when a
  letter is present (a lone seminar in a unit gets no letter, matching the
  tutorial rule). Keep the lecture branch as the default.
- At the call site (currently computing `tutorial_letters` then
  `label = _session_label(session, tutorial_letters.get(a.session_id))`):
  compute `seminar_letters` too and pass the letter appropriate to the session's
  type (tutorial → tutorial map, seminar → seminar map, lecture → `None`).

## Out of scope

- Any change to the export template, named styles, subject fills, borders,
  fills, page setup, or style-parity tests (seminars reuse class styling).
- A distinct seminar colour or block-style treatment — seminars are classes, not
  blocks.
- Frontend export/download UI (unchanged; Unit 94 streams the backend blob).

## Dependencies

- Unit 115 (`seminar` session type + allocations). No new packages.

## Tests

Backend (pytest, extending the Unit 93/96 export suite):

- A seminar session exports with label `CODE Seminar A (INIT)`; a lone seminar in
  its unit exports as `CODE Seminar (INIT)` with no letter.
- `_seminar_letters` orders by day → slot → room → session id, independent of
  tutorial letters (a unit with both gets Tutorial A/B and Seminar A/B).
- A seminar's cell uses the subject class style for its unit-code prefix (same as
  a tutorial/lecture of that unit) — no style-parity regression.
- Export still succeeds and structural style-parity tests are unchanged.

## Verification checklist

- Seminars appear in the exported workbook labelled `Seminar X` with an
  independent per-unit letter series matching the frontend (Unit 116).
- Seminars reuse existing class styling; no template or parity change.
- Export tests and build pass; `context/progress-tracker.md` and invariant 32
  wording (session labels now include Seminar) updated.
