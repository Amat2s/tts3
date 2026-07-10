# Unit 111 Spec: Backend Guarded Deletes With Dependency Reasons

## Goal

When a delete cannot proceed because the record is still referenced by other
data, return a **clear, structured error that names what the record is tied to**,
instead of a raw 500 / unhandled `IntegrityError`. Today only
`delete_timetable_block` catches `IntegrityError`; `delete_room`,
`delete_lecturer`, `delete_unit`, `delete_student`, and `delete_session` do not,
so a constraint violation surfaces as an unhandled error.

Backend-only. The frontend display of these messages is **Unit 112**.

## Design

- System boundary: `backend/` only.
- Return the existing structured error envelope (`AppError(code, message, status_code)`) with **status 409**, a stable machine `code`, and a
  human-readable `message` that lists the blocking dependencies.
- Prefer a **pre-delete dependency check** (query the referencing relationships
  and build the message) over relying solely on catching `IntegrityError`; keep
  an `IntegrityError` catch as a defensive fallback that rolls back and returns
  the same 409 shape.
- Never leak stack traces, SQL, or filesystem paths in the message.
- Respect existing intended cascades — do **not** block a delete that the product
  already defines as cascading (e.g. deleting a room unschedules its sessions;
  student/session allocation rebalancing). Only block where a real reference
  would otherwise fail or orphan data.

## Implementation

Files: `backend/services/room.py`, `lecturer.py`, `unit.py`, `student.py`,
`session.py` (and `api/errors.py` if a shared helper is added).

For each delete, gather the referencing dependencies and, if any block deletion,
raise a 409 whose message names them. Suggested per-entity dependency sources
(confirm against the actual models/cascades before implementing):

- **Room** — timetable **blocks** and **lecturer preferences** reference the
  room; scheduled **assignments** in the room. If the product cascades
  (unschedule/cascade), allow; otherwise name what remains tied.
- **Lecturer** — **teaching team** membership (`unit_lecturers`) and any
  **sessions** whose `lecturer_id` is this lecturer. Name the unit codes /
  session count, e.g. `on the teaching team of HIS101, PHI201`.
- **Unit** — **sessions**, **enrolled students** (`unit_students`), **teaching
  team**. If unit delete is defined to cascade sessions/enrolments, allow;
  otherwise report what blocks it.
- **Student** — enrolments (`unit_students`) and hidden allocations already
  cascade + rebalance; only report if a real reference blocks it.
- **Session** — allocations cascade; scheduled **assignment** referencing the
  session. Report if a reference blocks it.

Error shape (example):

```text
code:    lecturer_delete_blocked
status:  409
message: "Can't delete this lecturer yet — they're on the teaching team of
          HIS101, PHI201. Remove them from those units first."
```

Use one stable `code` per entity (e.g. `room_delete_blocked`,
`lecturer_delete_blocked`, `unit_delete_blocked`, `student_delete_blocked`,
`session_delete_blocked`) so the frontend can react generically.

Rules:

- Build messages from live data (names/codes/counts), not hardcoded lists.
- Keep messages short and specific; cap enumerated items (e.g. first few + "and N
  more") to avoid unbounded messages.
- Roll back the transaction on the defensive `IntegrityError` path and return the
  same 409.

## Dependencies

- Existing delete services and `AppError` envelope. No schema/migration changes.
  No new packages.

## Tests

Backend (pytest):

- Deleting a lecturer on a unit teaching team returns **409** with
  `lecturer_delete_blocked` and a message naming the unit code(s).
- Deleting a unit / room / student / session that is genuinely referenced returns
  the matching `*_delete_blocked` 409 with a descriptive message.
- Deletes that are supposed to succeed (including intended cascades) still return
  204 and perform their cascade/rebalance.
- The defensive `IntegrityError` path rolls back and returns 409 (no 500, no
  leaked internals).

## Verification checklist

- Each guarded delete returns a structured 409 naming the blocking dependencies
  when blocked, and still succeeds (with existing cascades) when allowed.
- Stable per-entity error codes are defined.
- No raw 500 / unhandled `IntegrityError`; no leaked internals.
- Backend tests pass; `context/progress-tracker.md` updated.
