# Unit 106 Spec: Timetable Action Bar — Save State, Download Lock, Message Clearing

## Goal

Fix three sticky-action-bar bugs on `/timetable`:

1. **Save button can freeze.** After a save request, the button/state does not
   reliably return to an idle, usable state once the save succeeds.
2. **Download is not locked while the draft is unsaved.** The `Download
Timetable` button must be disabled whenever the draft is dirty (export is of
   the _saved_ timetable only — Unit 94).
3. **Old messages pile up.** A new action-bar message should replace the
   previous one, **except** timetable clash/conflict warnings, which persist
   until the underlying conflict is resolved.

All three are **frontend-only** — no schema, API, or solver changes.

## Design

- System boundary: `frontend/` only.
- Do not modify protected `components/ui/*` primitives.
- Files: `frontend/src/features/timetable/TimetableActionBar.tsx` and the save
  mutation / draft state it reads (`frontend/src/routes/timetable.tsx`,
  `frontend/src/features/timetable/draftStorage.ts` as needed).
- Do not change what a valid save persists, the download endpoint, validation
  rules, or solver behaviour.

## Implementation

### 1. Save button must settle after success

- Ensure the save button's busy/disabled state is driven by the mutation
  lifecycle and always clears on both success and error (`onSettled`), so it
  never stays stuck in a spinning/disabled state after a successful save.
- After a successful save the button returns to its normal enabled/idle label
  and the dirty flag clears (draft marked saved), so the user can immediately
  keep editing or save again.
- Verify no path leaves the button disabled with the draft already clean.

### 2. Lock the download button while the draft is dirty

- The `Download Timetable` control must be disabled while the draft is dirty, in
  addition to the existing Unit 94 disabled conditions (save in progress, solver
  running/starting, saved data loading/failed, export already running).
- Reuse the existing dirty-draft disabled reason copy:

  ```text
  Save timetable changes before downloading.
  ```

- This reinforces Unit 94; confirm it holds after this unit (treat a regression
  here as the bug being fixed).

### 3. Replace transient messages; keep clash warnings

- When a new action-bar message arrives, it **replaces** the currently shown
  transient message rather than stacking with it.
- **Transient** messages (replaced on the next message): save success/failure,
  download success/failure, solver started/finished/partial, and generic info.
- **Persistent** messages (never auto-cleared by a newer message; cleared only
  when the underlying issue resolves): timetable **clash / conflict** warnings —
  i.e. the blocking and warning validation messages produced by the validation
  engine.
- Net effect: the bar shows the newest transient notice, and any active
  clash/conflict warnings remain visible alongside/under it until validation no
  longer reports them.
- Keep the action bar's stable min-height so message changes never shift the
  page (existing Unit 77 behaviour).

## Dependencies

- Units 77 (sticky action bar) and 94 (download UI) complete. No new packages.

## Tests

Frontend (Vitest + RTL):

- After a successful save, the save button returns to an enabled idle state and
  the draft is marked clean (not stuck disabled/spinning).
- Download button is disabled while the draft is dirty and shows the dirty
  reason; it re-enables after a successful save.
- A new transient message replaces the previous transient message.
- An active clash/conflict warning stays visible when a transient message
  (e.g. "Timetable downloaded.") arrives, and clears only when validation stops
  reporting it.

## Verification checklist

- Save never leaves the button frozen after a successful save.
- Download is blocked while the draft is dirty with the standard reason.
- Newest transient message shows; clash warnings persist until resolved.
- Action bar min-height stable (no page shift).
- Frontend tests and build pass.
- `context/progress-tracker.md` updated.
