# Unit 79 Spec: Frontend Local Timetable Draft Persistence

## Goal

Persist unsaved timetable draft state in browser storage so draft work is not lost when the admin leaves `/timetable` or refreshes the browser. Stored drafts must be schema-versioned, cleared after successful save, and validated/cleaned when restored.

## Design

- Keep this unit inside `frontend/`.
- Use browser storage (`localStorage` or `sessionStorage`) with an explicit schema version.
- Recommended default: `localStorage`, because it survives refresh and accidental tab close.
- Do not persist server-owned query data in Zustand or browser storage.
- Store only the current unsaved timetable draft and minimal metadata required for safe restoration.
- Do not create timetable version history.
- Do not sync draft state to backend until explicit save.
- Restored drafts must flow through existing blocking validation/automatic-unschedule logic.
- Clear the stored draft after successful save or explicit discard if such action exists.

## Implementation

### Storage schema

Create a dedicated draft persistence helper, for example:

- `frontend/src/features/timetable/draftStorage.ts`

Suggested stored shape:

```ts
type StoredTimetableDraft = {
  schemaVersion: 1;
  savedAssignmentFingerprint: string;
  updatedAt: string;
  assignments: TimetableAssignment[];
};
```

Include:

- safe JSON parse;
- schema version guard;
- validation that required assignment fields exist;
- clear helper;
- fingerprint helper for saved assignments.

### Fingerprint behavior

Prevent stale local drafts from silently overriding unrelated saved state:

- Compute a deterministic fingerprint from loaded saved assignments.
- Store the fingerprint alongside the draft.
- On restore, compare stored fingerprint to current saved assignments.
- If fingerprints match, restore the draft.
- If fingerprints do not match, prefer safe behavior:
  - either discard the stored draft automatically with a concise message in the sticky bar;
  - or restore only if all referenced sessions/rooms still exist and then validate.
- For this unit, prefer discard-on-fingerprint-mismatch unless the implementation can safely reconcile.

### Save and clear behavior

Update timetable draft lifecycle:

- When draft changes and is dirty, persist to storage.
- When draft returns clean after successful save, clear storage.
- When user clears all sessions in the draft, persist the empty draft as dirty until saved.
- When backend saved assignments refetch after save, do not resurrect an old stored draft.
- When user logs out, stored draft should not be reused for another account if multiple accounts become possible later. Include authenticated user ID or workspace key if available; otherwise include a clear TODO comment for future multi-admin scope without implementing multi-tenant behavior.

### Restore lifecycle

On `/timetable` load:

- Fetch saved assignments as usual.
- Initialize draft from saved assignments.
- Check for stored draft after saved assignments are available.
- Restore stored draft only when safe.
- Mark `isDirty = true` when a stored draft is restored.
- Run existing data-change/blocking cleanup effects on restored assignments.
- Keep warning validation derived normally.

### User feedback

Use the sticky action bar:

- Show a concise `Unsaved draft restored` message when a draft is restored.
- If a stored draft is discarded due to mismatch or invalid shape, show a non-technical message such as `Old unsaved draft was discarded because saved timetable data changed.`
- Do not show browser-storage implementation details.

### Tests

Add tests for:

- dirty draft writes to storage;
- route/page remount restores draft;
- browser refresh-style initialization restores draft;
- successful save clears storage;
- empty dirty draft persists until saved;
- invalid stored data is discarded safely;
- schema version mismatch is discarded;
- fingerprint mismatch is discarded or handled according to chosen behavior;
- restored blocking-invalid assignment is cleaned by existing auto-unschedule logic.

## Dependencies

No new dependencies expected.

## Verification checklist

- Unsaved draft survives leaving and returning to `/timetable`.
- Unsaved draft survives browser refresh when safe.
- Stored draft has schema version.
- Stored draft does not override changed saved backend state.
- Successful save clears stored draft.
- Empty dirty draft can be stored and later saved.
- Restored drafts still run through validation/auto-unschedule.
- No timetable version history is introduced.
- Frontend tests and build pass.
