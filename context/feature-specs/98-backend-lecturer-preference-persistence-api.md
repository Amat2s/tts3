# Unit 98 Spec: Backend Lecturer Preference Persistence and API

## Goal

Add persisted lecturer scheduling preferences and protected CRUD support. Preferences are room-specific soft-constraint cells, distinct from availability (hard constraint) and timetable blocks (hard constraint). This unit only creates the backend data/API contract; solver integration comes later.

## Design

- System boundary: `backend/`.
- A preference cell is `lecturer_id + day + slot + room_id`, mirroring the room-specific shape of timetable blocks.
- A cell has exactly one level: `preferred` or `avoid`. No row means neutral (no preference); neutral is never stored.
- Preferences are soft constraints only — they never block manual placement and are never checked against sessions, availability, or blocks at write time.
- The backend persists submitted cells as-is; it does not cross-validate against lecturer availability, timetable blocks, or existing sessions. Trust the frontend to send sane input.
- Preferences are not sessions and never appear in session/scheduling models.

## Implementation

### Data model and migration

Add `LecturerPreference`: `id`, `lecturer_id` (FK, cascade delete), `day`, `slot`, `room_id` (FK, cascade delete), `level` (`preferred` | `avoid`), timestamps.

Migration requirements:

- create preference level enum;
- unique constraint on `(lecturer_id, day, slot, room_id)`;
- indexes for `lecturer_id` and `(day, slot, room_id)`.

### Schemas and service

Add request/response schemas for list/upsert/delete.

Service rules:

- upsert by `(lecturer_id, day, slot, room_id)`: create the row if absent, overwrite `level` if present;
- delete removes the row entirely (returns the cell to neutral);
- validate `lecturer_id` and `room_id` reference existing rows;
- validate `level` is one of the two allowed values;
- no other validation — do not check availability, blocks, or sessions.

### API routes

Add protected routes:

```text
GET    /lecturers/{lecturer_id}/preferences
PUT    /lecturer-preferences
DELETE /lecturer-preferences
```

- `GET` returns all preference cells for one lecturer.
- `PUT` upserts a single cell (`lecturer_id, day, slot, room_id, level`).
- `DELETE` removes a single cell back to neutral (`lecturer_id, day, slot, room_id`).

Route handlers stay thin and return structured errors only for unknown lecturer/room ids and invalid `level` values.

## Dependencies

Units 84-97 complete.

No new dependencies expected.

## Verification checklist

- Preference cells persist correctly, keyed by lecturer, day, slot, and room.
- Neutral cells are never stored as rows.
- A cell holds exactly one level: `preferred` or `avoid`.
- Upsert overwrites an existing cell's level.
- Delete returns a cell to neutral.
- No cross-validation against availability, blocks, or sessions occurs.
- Protected routes exist for get/upsert/delete.
- Backend tests pass.
