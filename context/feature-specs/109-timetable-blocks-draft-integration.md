# Unit 109 Spec: Timetable Blocks Folded Into the Draft

## Goal

Stop disabling block editing while the timetable draft is dirty. Today blocks
persist **immediately** through the block API, so block create/edit/delete is
disabled whenever there are unsaved timetable changes. Change the model so
**block edits become part of the unsaved timetable draft** and persist together
with assignments on **Save** — the admin can edit blocks any time, saved or not.

This unit changes the **block persistence contract** (a documented invariant),
so it updates the context files (see **Context updates**).

## Design

- System boundary: `frontend/` only. Reuse the existing block CRUD API
  (Units 84/85) at **save time**; no new backend endpoints, schema, or solver
  changes.
- Do not modify protected `components/ui/*` primitives.
- Files: `frontend/src/features/timetable/blocks.ts`, `blockSelection.ts`,
  `draftStorage.ts`, `BlockCreateDialog.tsx`, `BlockEditDialog.tsx`,
  `TimetableActionBar.tsx`, `TimetableGrid.tsx`, `frontend/src/routes/timetable.tsx`.

### Model change

- Block edits (add cells, name/colour, delete a block) are recorded in the
  **frontend draft**, not pushed to the backend on each action.
- The draft now has two layers of pending change: **assignment** edits (existing)
  and **block** edits (new). Both are dirty-tracked together and both are
  persisted by the single **Save** action.
- Remove the "block editing disabled while draft dirty" guard entirely. Blocks
  and assignments are edited freely and saved together.

## Implementation

### Draft state

- Extend the draft state + versioned browser-storage schema
  (`draftStorage.ts`) to carry pending block changes alongside assignments.
  Bump the draft schema version; discard/migrate stale stored drafts safely
  (existing Unit 79 behaviour).
- Blocks in the draft still enforce the existing **hard-constraint** rules
  locally: manual placement into a blocked cell is rejected, and creating/moving
  a block over a draft-scheduled cell auto-unschedules the overlapping draft
  assignment (Unit 86 rules), now computed against draft blocks.

### Save flow

- On Save, persist block changes and assignment changes as one user action:
  apply pending block create/update/delete via the existing block API, then
  persist assignments (or the reverse — pick the order that keeps the backend's
  "creating a block unschedules overlapping saved assignments" behaviour
  consistent with the just-saved assignment set) and state the chosen order in
  the route.
- After a successful save, clear both pending layers and mark the draft clean
  (coordinate with Unit 106's save-settle fix).
- On failure, keep the draft (blocks + assignments) intact and surface the error;
  do not partially clear.

### Action bar / editing

- Block-selection/edit controls are available regardless of draft dirtiness.
- Because blocks are no longer immediately persisted, remove the immediate-persist
  messaging and the dirty-draft disabled reason for blocks.

## Context updates

This unit deliberately changes documented behaviour — update in the same unit:

- `context/project-overview.md` — the **Timetable Blocks** section: blocks are
  edited in the draft and persist on Save (remove "persist immediately … block
  create/edit/delete is disabled while the timetable draft is dirty").
- `context/architecture-context.md` — invariants/boundary notes describing
  immediate block persistence and the dirty-draft guard; note blocks now travel
  with the timetable draft and persist on Save, and the browser-draft now
  includes pending block changes.
- `context/ui-context.md` — if it references the block dirty-draft guard.
- `context/progress-tracker.md` — record the contract change.

## Dependencies

- Units 84–88 (blocks) complete; Unit 79 (draft persistence); coordinates with
  Unit 106 (save settle). No new packages.

## Tests

Frontend (Vitest + RTL):

- Block create/edit/delete is available while the draft has unsaved assignment
  changes (no disabled guard).
- A block edit marks the draft dirty and is **not** sent to the backend until
  Save; Save persists blocks and assignments together and clears both layers.
- Creating a draft block over a draft-scheduled cell auto-unschedules that draft
  assignment locally.
- A stored draft round-trips pending block changes across reload; stale/old-schema
  drafts are discarded safely.
- Save failure leaves both pending layers intact with an error shown.

## Verification checklist

- Blocks are editable whether or not the draft is saved (guard removed).
- Block edits live in the draft and persist only on Save, together with
  assignments.
- Local block hard-constraint rules still apply against draft blocks.
- Browser draft carries block edits; schema version bumped and safe on load.
- Context files (`project-overview`, `architecture-context`, `ui-context`,
  progress tracker) updated.
- Frontend tests and build pass.
