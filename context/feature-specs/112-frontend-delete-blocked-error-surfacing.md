# Unit 112 Spec: Frontend Delete-Blocked Error Surfacing

## Goal

Show the admin **why** a delete was refused and **what the record is tied to**,
using the structured 409 errors from Unit 111. When a delete is blocked, the
management page must display the backend's human-readable reason instead of a
generic failure or silent no-op.

Frontend-only.

## Design

- System boundary: `frontend/` only.
- Do not modify protected `components/ui/*` primitives.
- Files: the management routes / delete flows for rooms, lecturers, units,
  students, and sessions (`frontend/src/routes/rooms.tsx`, `lecturers.tsx`,
  `units.tsx`, `students.tsx`, and the session delete UI inside the unit modal),
  plus the shared API client error handling.
- Depends on Unit 111 (structured `*_delete_blocked` 409s with descriptive
  messages).

## Implementation

- On a delete mutation error, read the structured error (`code` + `message`) from
  the API client and surface the backend `message` to the user via the existing
  error surface for that page (inline `Alert`, toast, or the delete-confirmation
  dialog — match the pattern already used on that page).
- The message shown is the backend's reason (e.g. "Can't delete this lecturer
  yet — they're on the teaching team of HIS101, PHI201."). Do not overwrite it
  with a generic string; fall back to a generic "Couldn't delete — it's still in
  use." only when no structured message is present.
- Keep the record intact and the UI consistent: a blocked delete must not
  optimistically remove the row; if an optimistic removal already happened, roll
  it back on error.
- Delete confirmation is still required first (existing UX invariant); the
  blocked reason appears after the user confirms and the request fails.
- Do not rely on colour alone — pair the error styling with the text reason and a
  warning icon (Design Invariant 8).

## Dependencies

- Unit 111. No new packages.

## Tests

Frontend (Vitest + RTL):

- A blocked delete (mocked 409 with a `*_delete_blocked` code + message) shows the
  backend message on the page and leaves the row present.
- A successful delete still removes the row with no error shown.
- Missing/blank structured message falls back to the generic reason.
- An optimistic removal (if used) is rolled back on a blocked delete.

## Verification checklist

- Blocked deletes show the backend's specific "tied to X" reason on rooms,
  lecturers, units, students, and sessions.
- The record stays visible after a blocked delete; successful deletes still work.
- Confirmation-before-delete is preserved; error is not colour-only.
- Frontend tests and build pass; `context/progress-tracker.md` updated.
